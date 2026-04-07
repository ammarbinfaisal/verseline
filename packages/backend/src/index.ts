import app, { bunWebsocket } from "./app.js";

const port = parseInt(process.env.PORT ?? "3001", 10);

console.log(`[verseline-backend] starting on port ${port}`);

const server = Bun.serve({
  port,
  // Hono's upgradeWebSocket needs the server ref via c.env
  fetch(req, server) {
    return app.fetch(req, { server });
  },
  websocket: bunWebsocket,
});

console.log(`[verseline-backend] listening at http://localhost:${port}`);
