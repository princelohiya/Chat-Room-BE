import express from "express";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const httpServer = app.listen(8080, () => {
  console.log("Server is listening on port 8080");
});

const wss = new WebSocketServer({ server: httpServer });
const activeClients = new Set<WebSocket>();

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
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });
  });

  ws.on("close", () => {
    activeClients.delete(ws);
  });
});
