import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
} from "../services/auth.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";

type AuthEnv = {
  Variables: { userId: string };
};

const auth = new Hono<AuthEnv>();

// POST /auth/signup
auth.post("/signup", async (c) => {
  const allowSignup = process.env.ALLOW_SIGNUP;
  if (allowSignup === "false" || allowSignup === "0") {
    return c.json({ error: "Sign-up is disabled" }, 403);
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { email, password } = body;
  if (
    typeof email !== "string" ||
    !email.includes("@") ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    return c.json(
      { error: "Valid email and password (min 8 chars) are required" },
      400,
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), passwordHash })
    .returning({ id: users.id, email: users.email });

  const token = await signToken(user.id);
  return c.json({ token, user: { id: user.id, email: user.email } }, 201);
});

// POST /auth/login
auth.post("/login", async (c) => {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { email, password } = body;
  if (typeof email !== "string" || typeof password !== "string") {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await signToken(user.id);
  return c.json({ token, user: { id: user.id, email: user.email } });
});

// GET /auth/me
auth.get("/me", authMiddleware, async (c) => {
  const userId = getUserId(c);
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
});

export default auth;
