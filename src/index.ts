import express from "express";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const httpServer = app.listen(8080, () => {
  console.log("Server is listening on port 8080");
});

const wss = new WebSocketServer({ server: httpServer });

type ClientWithLabel = { ws: WebSocket; label: "A" | "B" };
const activeClients: ClientWithLabel[] = [];

wss.on("connection", function connection(ws) {
  if (activeClients.length >= 2) {
    ws.send("Connection closed: Server limit of 2 clients reached");
    ws.close(1000, "Server limit of 2 clients reached");
    return;
  }

  const label: "A" | "B" = activeClients.length === 0 ? "A" : "B";
  activeClients.push({ ws, label });

  // Inform the connecting client of their label
  ws.send(JSON.stringify({ type: "assign", label }));

  ws.on("message", function message(data, isBinary) {
    let msg = null;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      // If not JSON, treat as normal message.
    }

    // If received a disconnect_all instruction, close all
    if (msg && msg.type === "disconnect_all") {
      // This will disconnect all clients immediately.
      activeClients.forEach(({ ws: clientWs }) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: "server",
              message: "Session ended by user.",
            })
          );
          clientWs.close(4001, "Session ended by user.");
        }
      });
      // Optionally, clear the clients array
      activeClients.length = 0;
      return;
    }
    // Relay this message to all clients WITH the sender's label attached
    activeClients.forEach(({ ws: clientWs }) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({ type: "chat", label, message: data.toString() })
        );
      }
    });
  });

  ws.on("close", () => {
    const idx = activeClients.findIndex((client) => client.ws === ws);
    if (idx !== -1) activeClients.splice(idx, 1);
  });
});
