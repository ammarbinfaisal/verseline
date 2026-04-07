import { cors } from "hono/cors";

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

// Allow localhost origins in development for testing
const allowedOrigins = new Set([frontendUrl]);
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://localhost:5173");
}

export const corsMiddleware = cors({
  origin: (origin) => (allowedOrigins.has(origin) ? origin : frontendUrl),
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
