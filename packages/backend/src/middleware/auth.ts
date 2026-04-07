import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { jwtVerify } from "jose";

type AuthEnv = {
  Variables: {
    userId: string;
  };
};

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return new TextEncoder().encode(secret);
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) {
      return c.json({ error: "Invalid token" }, 401);
    }
    c.set("userId", payload.sub);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});

export function getUserId(c: Context<AuthEnv>): string {
  return c.get("userId");
}
