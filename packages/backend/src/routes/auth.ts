import { Hono } from "hono";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, passwordResetTokens } from "../db/schema.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
} from "../services/auth.js";
import { sendPasswordResetEmail } from "../services/email.js";
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

// Rate limiting for forgot-password: 3 requests per 5 minutes per IP
const resetRateMap = new Map<string, number[]>();
const RESET_RATE_LIMIT = 3;
const RESET_RATE_WINDOW_MS = 5 * 60 * 1000;

function checkResetRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (resetRateMap.get(ip) ?? []).filter((t) => now - t < RESET_RATE_WINDOW_MS);
  if (timestamps.length >= RESET_RATE_LIMIT) {
    resetRateMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  resetRateMap.set(ip, timestamps);
  return true;
}

// POST /auth/forgot-password
auth.post("/forgot-password", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    ?? c.req.header("x-real-ip")
    ?? "unknown";
  if (!checkResetRateLimit(ip)) {
    return c.json({ error: "Too many requests. Try again in a few minutes." }, 429);
  }

  let body: { email?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { email } = body;
  if (typeof email !== "string" || !email.includes("@")) {
    return c.json({ error: "Valid email is required" }, 400);
  }

  // Always return 200 to avoid leaking whether the email exists
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (user) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail(email.toLowerCase(), resetUrl);
    } catch (err) {
      console.error("[forgot-password] Failed to send email:", err);
    }
  }

  return c.json({ message: "If an account exists with that email, a reset link has been sent." });
});

// POST /auth/reset-password
auth.post("/reset-password", async (c) => {
  let body: { token?: unknown; password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { token, password } = body;
  if (typeof token !== "string" || typeof password !== "string" || password.length < 8) {
    return c.json({ error: "Valid token and password (min 8 chars) are required" }, 400);
  }

  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expiresAt, new Date()),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .limit(1);

  if (!resetToken) {
    return c.json({ error: "Invalid or expired reset token" }, 400);
  }

  const newHash = await hashPassword(password);

  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, resetToken.userId));

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, resetToken.id));

  return c.json({ message: "Password has been reset successfully." });
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
