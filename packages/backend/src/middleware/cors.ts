import { cors } from "hono/cors";

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

export const corsMiddleware = cors({
  origin: frontendUrl,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
