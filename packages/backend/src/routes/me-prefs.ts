/**
 * Per-user preferences (theme + shortcuts), mounted under /me/prefs.
 *
 *   GET /me/prefs   — current prefs (creates default row on first call)
 *   PUT /me/prefs   — partial update; only fields present in the body change
 *
 * See /design.md §V2.6.
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { userPrefs } from "../db/schema.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";

type AuthEnv = {
  Variables: { userId: string };
};

const ThemeSchema = z.enum(["system", "light", "warm", "dark"]);

// Permissive — the client knows the action set; we just store strings.
// Validation that the binding is a syntactically valid combo lives client-side.
const PrefsBodySchema = z.object({
  theme: ThemeSchema.optional(),
  preferWarmInLight: z.boolean().optional(),
  shortcuts: z.record(z.string(), z.string()).optional(),
});

const router = new Hono<AuthEnv>();

router.use("*", authMiddleware);

router.get("/", async (c) => {
  const userId = getUserId(c);
  let [row] = await db.select().from(userPrefs).where(eq(userPrefs.userId, userId)).limit(1);

  if (!row) {
    const [created] = await db
      .insert(userPrefs)
      .values({ userId })
      .returning();
    row = created;
  }

  return c.json({
    prefs: {
      theme: row.theme,
      preferWarmInLight: row.preferWarmInLight,
      shortcuts: row.shortcuts as Record<string, string>,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    },
  });
});

router.put("/", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);

  const parsed = PrefsBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid prefs body", detail: parsed.error.issues }, 400);
  }
  const patch = parsed.data;

  // Make sure a row exists.
  const [existing] = await db.select().from(userPrefs).where(eq(userPrefs.userId, userId)).limit(1);
  if (!existing) {
    await db.insert(userPrefs).values({ userId });
  }

  const setValues: Partial<typeof userPrefs.$inferInsert> = { updatedAt: new Date() };
  if (patch.theme !== undefined) setValues.theme = patch.theme;
  if (patch.preferWarmInLight !== undefined)
    setValues.preferWarmInLight = patch.preferWarmInLight;
  if (patch.shortcuts !== undefined) setValues.shortcuts = patch.shortcuts;

  const [updated] = await db
    .update(userPrefs)
    .set(setValues)
    .where(eq(userPrefs.userId, userId))
    .returning();

  if (!updated) return c.json({ error: "Failed to update prefs" }, 500);

  return c.json({
    prefs: {
      theme: updated.theme,
      preferWarmInLight: updated.preferWarmInLight,
      shortcuts: updated.shortcuts as Record<string, string>,
      updatedAt: updated.updatedAt?.toISOString() ?? null,
    },
  });
});

export default router;
