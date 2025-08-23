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
const activeClients = new Set();
wss.on("connection", function connection(ws) {
    if (activeClients.size >= 2) {
        ws.close(1000, "Server limit of 2 clients reached");
        ws.send("Connection closed: Server limit of 2 clients reached");
        return; // Do not register further events for this client
    }
    activeClients.add(ws);
    ws.send("Connected");
    ws.on("message", function message(data, isBinary) {
        wss.clients.forEach(function each(client) {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(data, { binary: isBinary });
            }
        });
    });
    ws.on("close", () => {
        activeClients.delete(ws);
    });
});
