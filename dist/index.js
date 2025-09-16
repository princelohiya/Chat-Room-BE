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
    if (activeClients.length >= 2) {
        //check if b is already there
        if (activeClients.some((client) => client.label === "B")) {
            ws.send(JSON.stringify({ type: "server", message: "Room is full." }));
            ws.close(4000, "Room is full.");
            return;
        }
    }
    const label = activeClients.length === 0 ? "A" : "B";
    activeClients.push({ ws, label });
    // Inform the connecting client of their label
    ws.send(JSON.stringify({ type: "assign", label }));
    ws.on("message", function message(data, isBinary) {
        let msg = null;
        try {
            msg = JSON.parse(data.toString());
        }
        catch (_a) {
            // If not JSON, treat as normal message.
        }
        // Typing indicator logic
        if (msg && msg.type === "typing") {
            // Find the sender's label
            const client = activeClients.find((c) => c.ws === ws);
            if (!client)
                return;
            // Send typing status to the other client
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
        // If received a disconnect_all instruction, close all
        if (msg && msg.type === "disconnect_all") {
            // This will disconnect all clients immediately.
            activeClients.forEach(({ ws: clientWs }) => {
                if (clientWs.readyState === ws_1.WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                        type: "server",
                        message: "Session ended by user.",
                    }));
                    clientWs.close(4001, "Session ended by user.");
                }
            });
            // Optionally, clear the clients array
            activeClients.length = 0;
            return;
        }
        // Relay this message to all clients WITH the sender's label attached
        activeClients.forEach(({ ws: clientWs }) => {
            if (clientWs.readyState === ws_1.WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: "chat", label, message: data.toString() }));
            }
        });
    });
    ws.on("close", () => {
        const idx = activeClients.findIndex((client) => client.ws === ws);
        if (idx !== -1)
            activeClients.splice(idx, 1);
    });
});
