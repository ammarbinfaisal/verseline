import { Hono } from "hono";
import { websocket } from "hono/bun";
import { corsMiddleware } from "./middleware/cors.js";
import { geoMiddleware } from "./middleware/geo.js";
import { authMiddleware } from "./middleware/auth.js";
import authRouter from "./routes/auth.js";
import projectsRouter from "./routes/projects.js";
import timelineRouter from "./routes/timeline.js";
import fontsRouter from "./routes/fonts.js";
import renderRouter from "./routes/render.js";
import assetsRouter from "./routes/assets.js";
import importExportRouter from "./routes/import-export.js";
import libraryRouter from "./routes/library.js";
import pexelsRouter from "./routes/pexels.js";
import renderProgressRouter from "./ws/render-progress.js";

type AuthEnv = {
  Variables: { userId: string };
};

const app = new Hono<AuthEnv>();

// Re-export the Bun WebSocket handler so index.ts can pass it to Bun.serve
export { websocket as bunWebsocket };

// Global middleware
app.use("*", corsMiddleware);
app.use("*", geoMiddleware);

// Health check
app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

// Auth routes (no auth required for signup/login)
app.route("/auth", authRouter);

// Protected project routes
app.use("/projects/*", authMiddleware);
app.route("/projects", projectsRouter);
app.route("/projects", timelineRouter);

// Protected font routes
app.use("/fonts/*", authMiddleware);
app.route("/fonts", fontsRouter);

// Protected render routes
app.use("/projects/*", authMiddleware);
app.use("/render/*", authMiddleware);
app.route("/projects", renderRouter);
app.route("/render", renderRouter);

// Protected asset routes
app.route("/projects", assetsRouter);

// Import/export routes
app.route("/projects", importExportRouter);

// Protected library routes
app.use("/library/*", authMiddleware);
app.route("/library", libraryRouter);

// Protected Pexels routes
app.use("/pexels/*", authMiddleware);
app.route("/pexels", pexelsRouter);

// WebSocket render progress (no HTTP auth — jobId is the implicit secret)
app.route("/ws/render", renderProgressRouter);

// Global error handler
app.onError((err, c) => {
  console.error("[error]", err);
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : (err instanceof Error ? err.message : String(err));
  return c.json({ error: message }, 500);
});

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
