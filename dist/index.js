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
        ws.send("Connection closed: Server limit of 2 clients reached");
        ws.close(1000, "Server limit of 2 clients reached");
        return;
    }
    const label = activeClients.length === 0 ? "A" : "B";
    activeClients.push({ ws, label });
    // Inform the connecting client of their label
    ws.send(JSON.stringify({ type: "assign", label }));
    ws.on("message", function message(data, isBinary) {
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
