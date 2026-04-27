/**
 * Preset library routes (mounted under /presets).
 *
 * Mixed auth: the built-in catalogue (`GET /presets/builtin`) is open; every
 * other endpoint requires auth and operates on the caller's own rows.
 *
 *   GET    /                — list presets for the current user (?kind= filter)
 *                              also includes built-in rows in the response.
 *   POST   /                — upsert one preset {kind, payload}
 *   PUT    /:id             — replace payload of an owned preset
 *   DELETE /:id             — delete an owned preset (built-in: 403)
 *   GET    /builtin         — built-in catalogue (no auth required)
 *
 * See /design.md §V2.1 for the schema and contract.
 */

import { Hono } from "hono";
import { and, eq, or, sql } from "drizzle-orm";
import {
  PresetKindSchema,
  validatePresetPayload,
  type PresetKind,
  type PresetRecord,
} from "@verseline/shared";
import { db } from "../db/index.js";
import { presets } from "../db/schema.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";

type AuthEnv = {
  Variables: { userId: string };
};

const presetsRouter = new Hono<AuthEnv>();

// ---- helpers ---------------------------------------------------------------

type Row = typeof presets.$inferSelect;

function rowToRecord(row: Row): PresetRecord {
  return {
    id: row.id,
    userId: row.userId ?? null,
    kind: row.kind as PresetKind,
    payload: row.payload as PresetRecord["payload"],
    builtIn: row.builtIn,
    createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}

function parseKindParam(raw: string | undefined): PresetKind | null {
  if (!raw) return null;
  const parsed = PresetKindSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// ---- GET /builtin (no auth) ------------------------------------------------

presetsRouter.get("/builtin", async (c) => {
  const kindRaw = c.req.query("kind");
  const kind = parseKindParam(kindRaw ?? undefined);

  const rows = await db
    .select()
    .from(presets)
    .where(
      kind
        ? and(eq(presets.builtIn, true), eq(presets.kind, kind))
        : eq(presets.builtIn, true),
    );
  return c.json({ presets: rows.map(rowToRecord) });
});

// ---- everything below requires auth ----------------------------------------

presetsRouter.use("*", authMiddleware);

// ---- GET / -----------------------------------------------------------------

presetsRouter.get("/", async (c) => {
  const userId = getUserId(c);
  const kindRaw = c.req.query("kind");
  const kind = parseKindParam(kindRaw ?? undefined);

  // Pull user's own + all built-in rows. Built-ins always travel along so the
  // picker has them without a second round-trip.
  const where = kind
    ? and(
        or(eq(presets.userId, userId), eq(presets.builtIn, true)),
        eq(presets.kind, kind),
      )
    : or(eq(presets.userId, userId), eq(presets.builtIn, true));

  const rows = await db.select().from(presets).where(where);
  return c.json({ presets: rows.map(rowToRecord) });
});

// ---- POST / (upsert) -------------------------------------------------------
//
// Request: { kind, payload }
// Upsert keyed on (userId, kind, payload->>'id').
// If the same payload-id already exists for this user+kind, we replace.

presetsRouter.post("/", async (c) => {
  const userId = getUserId(c);
  const body = (await c.req.json().catch(() => null)) as
    | { kind?: unknown; payload?: unknown }
    | null;
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);

  const kindParsed = PresetKindSchema.safeParse(body.kind);
  if (!kindParsed.success) {
    return c.json({ error: "Invalid kind", detail: kindParsed.error.issues }, 400);
  }
  const kind = kindParsed.data;

  let payload;
  try {
    payload = validatePresetPayload(kind, body.payload);
  } catch (err) {
    return c.json(
      {
        error: "Invalid payload for kind " + kind,
        detail: err instanceof Error ? err.message : String(err),
      },
      400,
    );
  }

  // Upsert by (userId, kind, payload->>'id'). Drizzle's onConflictDoUpdate
  // can't take an expression target, so do select-then-update-or-insert.
  // The unique index on the column expression still prevents races at the DB
  // layer — concurrent inserts would 409 from the duplicate-key error.
  const payloadId = (payload as { id: string }).id;

  const [existing] = await db
    .select()
    .from(presets)
    .where(
      and(
        eq(presets.userId, userId),
        eq(presets.kind, kind),
        sql`(payload->>'id') = ${payloadId}`,
      ),
    )
    .limit(1);

  let row;
  if (existing) {
    [row] = await db
      .update(presets)
      .set({ payload, updatedAt: new Date() })
      .where(eq(presets.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(presets)
      .values({ userId, kind, payload, builtIn: false })
      .returning();
  }

  if (!row) return c.json({ error: "Failed to upsert preset" }, 500);
  return c.json({ preset: rowToRecord(row) });
});

// ---- PUT /:id --------------------------------------------------------------

presetsRouter.put("/:id", async (c) => {
  const userId = getUserId(c);
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as
    | { payload?: unknown }
    | null;
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);

  const [existing] = await db
    .select()
    .from(presets)
    .where(eq(presets.id, id))
    .limit(1);

  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.builtIn || existing.userId !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let payload;
  try {
    payload = validatePresetPayload(existing.kind as PresetKind, body.payload);
  } catch (err) {
    return c.json(
      {
        error: "Invalid payload for kind " + existing.kind,
        detail: err instanceof Error ? err.message : String(err),
      },
      400,
    );
  }

  const [updated] = await db
    .update(presets)
    .set({ payload, updatedAt: new Date() })
    .where(eq(presets.id, id))
    .returning();

  if (!updated) return c.json({ error: "Failed to update preset" }, 500);
  return c.json({ preset: rowToRecord(updated) });
});

// ---- DELETE /:id -----------------------------------------------------------

presetsRouter.delete("/:id", async (c) => {
  const userId = getUserId(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(presets)
    .where(eq(presets.id, id))
    .limit(1);

  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.builtIn) return c.json({ error: "Cannot delete built-in preset" }, 403);
  if (existing.userId !== userId) return c.json({ error: "Forbidden" }, 403);

  await db.delete(presets).where(eq(presets.id, id));
  return c.body(null, 204);
});

export default presetsRouter;
