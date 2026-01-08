import express from "express";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const httpServer = app.listen(8080, () => {
  console.log("Server is listening on port 8080");
});

const wss = new WebSocketServer({ server: httpServer });

type ClientWithLabel = { ws: WebSocket; label: "A" | "B" };
const activeClients: ClientWithLabel[] = [];

// 👇 NEW: Helper to send the count to everyone
function broadcastUserCount() {
  const count = activeClients.length;
  const message = JSON.stringify({ type: "user_count", count: count });

  activeClients.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) {
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
  const label: "A" | "B" = takenLabels.includes("A") ? "B" : "A";

  activeClients.push({ ws, label });

  // Inform the connecting client of their label
  ws.send(JSON.stringify({ type: "assign", label }));

  setTimeout(() => {
    broadcastUserCount();
  }, 50);

  ws.on("message", function message(data, isBinary) {
    let msg = null;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      // If not JSON, treat as normal chat message.
    }

    // ---- HANDLERS ----

    // A. Typing Indicator
    if (msg && msg.type === "typing") {
      const client = activeClients.find((c) => c.ws === ws);
      if (!client) return;

      activeClients.forEach(({ ws: clientWs }) => {
        if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: "typing",
              status: msg.status,
              label: client.label,
            })
          );
        }
      });
      return;
    }

    // B. Disconnect All (Panic Button)
    if (msg && msg.type === "disconnect_all") {
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
      activeClients.length = 0;
      // 👇 NEW: Update count to 0 (though sockets are closed, it's good practice)
      broadcastUserCount();
      return;
    }

    // C. Chat Message Relay
    activeClients.forEach(({ ws: clientWs }) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: "chat",
            label,
            message: data.toString(),
          })
        );
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
