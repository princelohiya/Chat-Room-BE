"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const app = (0, express_1.default)();
const httpServer = app.listen(8080, () => {
    console.log("Server is listening on port 8080");
});
const wss = new ws_1.WebSocketServer({ server: httpServer });
const activeClients = [];
// 👇 NEW: Helper to send the count to everyone
function broadcastUserCount() {
    const count = activeClients.length;
    console.log("Broadcasting count:", count);
    const message = JSON.stringify({ type: "user_count", count: count });
    activeClients.forEach(({ ws }) => {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(message);
        }
    });
}
wss.on("connection", function connection(ws) {
    // 1. Check if room is full
    if (activeClients.length >= 2) {
        ws.send(JSON.stringify({ type: "server", message: "Room is full." }));
        ws.close(4000, "Room is full.");
        return;
    }
    // 2. FIXED LABEL LOGIC
    const takenLabels = activeClients.map((c) => c.label);
    const label = takenLabels.includes("A") ? "B" : "A";
    activeClients.push({ ws, label });
    // Inform the connecting client of their label
    ws.send(JSON.stringify({ type: "assign", label }));
    // 👇 NEW: Update count after adding user
    setTimeout(() => {
        broadcastUserCount();
    }, 500);
    ws.on("message", function message(data, isBinary) {
        let msg = null;
        try {
            msg = JSON.parse(data.toString());
        }
        catch (_a) {
            // If not JSON, treat as normal chat message.
        }
        // ---- HANDLERS ----
        // A. Typing Indicator
        if (msg && msg.type === "typing") {
            const client = activeClients.find((c) => c.ws === ws);
            if (!client)
                return;
            activeClients.forEach(({ ws: clientWs }) => {
                if (clientWs !== ws && clientWs.readyState === ws_1.WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                        type: "typing",
                        status: msg.status,
                        label: client.label,
                    }));
                }
            });
            return;
        }
        // B. Disconnect All (Panic Button)
        if (msg && msg.type === "disconnect_all") {
            activeClients.forEach(({ ws: clientWs }) => {
                if (clientWs.readyState === ws_1.WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                        type: "server",
                        message: "Session ended by user.",
                    }));
                    clientWs.close(4001, "Session ended by user.");
                }
            });
            activeClients.length = 0;
            // 👇 NEW: Update count to 0 (though sockets are closed, it's good practice)
            broadcastUserCount();
            return;
        }
        // C. Chat Message Relay
        activeClients.forEach(({ ws: clientWs }) => {
            if (clientWs.readyState === ws_1.WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                    type: "chat",
                    label,
                    message: data.toString(),
                }));
            }
        });
    });
    ws.on("close", () => {
        const idx = activeClients.findIndex((client) => client.ws === ws);
        if (idx !== -1) {
            console.log(`User ${activeClients[idx].label} disconnected.`);
            activeClients.splice(idx, 1);
            // 👇 NEW: Update count immediately after removing user
            broadcastUserCount();
        }
    });
});
