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
wss.on("connection", function connection(ws) {
    // 1. Check if room is full
    if (activeClients.length >= 2) {
        ws.send(JSON.stringify({ type: "server", message: "Room is full." }));
        ws.close(4000, "Room is full.");
        return;
    }
    // 2. FIXED LABEL LOGIC: Check which label is actually missing
    const takenLabels = activeClients.map((c) => c.label);
    const label = takenLabels.includes("A") ? "B" : "A";
    activeClients.push({ ws, label });
    console.log(`User ${label} connected. Total: ${activeClients.length}`);
    // Inform the connecting client of their label
    ws.send(JSON.stringify({ type: "assign", label }));
    ws.on("message", function message(data, isBinary) {
        let msg = null;
        try {
            msg = JSON.parse(data.toString());
        }
        catch (_a) {
            // If not JSON (e.g., Encrypted String), treat as normal chat message.
        }
        // ---- HANDLERS ----
        // A. Typing Indicator
        if (msg && msg.type === "typing") {
            const client = activeClients.find((c) => c.ws === ws);
            if (!client)
                return;
            // Broadcast to others
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
            activeClients.length = 0; // Clear array immediately
            return;
        }
        // C. Chat Message Relay (Works with E2EE)
        // We forward the raw data string. If it's encrypted, we forward the ciphertext.
        activeClients.forEach(({ ws: clientWs }) => {
            if (clientWs.readyState === ws_1.WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                    type: "chat",
                    label,
                    message: data.toString(), // This sends the Encrypted String
                }));
            }
        });
    });
    ws.on("close", () => {
        const idx = activeClients.findIndex((client) => client.ws === ws);
        if (idx !== -1) {
            console.log(`User ${activeClients[idx].label} disconnected.`);
            activeClients.splice(idx, 1);
        }
    });
});
