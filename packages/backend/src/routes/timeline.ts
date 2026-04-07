import { Hono } from "hono";
import { eq, and, gt, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects, segments } from "../db/schema.js";
import { getUserId } from "../middleware/auth.js";

type AuthEnv = {
  Variables: { userId: string };
};

const timeline = new Hono<AuthEnv>();

// Verify project ownership and return project id
async function verifyProjectOwnership(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return !!project;
}

// GET /:projectId/segments — list segments by kind
timeline.get("/:projectId/segments", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("projectId");
  const kind = c.req.query("kind") ?? "draft";

  const owned = await verifyProjectOwnership(projectId, userId);
  if (!owned) return c.json({ error: "Project not found" }, 404);

  const rows = await db
    .select()
    .from(segments)
    .where(
      and(
        eq(segments.projectId, projectId),
        eq(segments.timelineKind, kind),
      ),
    )
    .orderBy(asc(segments.sortOrder));

  return c.json({ segments: rows });
});

// POST /:projectId/segments — create new segment
timeline.post("/:projectId/segments", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("projectId");

  const owned = await verifyProjectOwnership(projectId, userId);
  if (!owned) return c.json({ error: "Project not found" }, 404);

  let body: Record<string, unknown> = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.startMs !== "number" || typeof body.endMs !== "number") {
    return c.json({ error: "startMs and endMs are required numbers" }, 400);
  }

  // Determine next sortOrder
  const existing = await db
    .select({ sortOrder: segments.sortOrder })
    .from(segments)
    .where(
      and(
        eq(segments.projectId, projectId),
        eq(segments.timelineKind, (body.timelineKind as string) ?? "draft"),
      ),
    )
    .orderBy(asc(segments.sortOrder));

  const nextOrder =
    existing.length > 0
      ? (existing[existing.length - 1]?.sortOrder ?? 0) + 1
      : 0;

  const [segment] = await db
    .insert(segments)
    .values({
      projectId,
      timelineKind: typeof body.timelineKind === "string" ? body.timelineKind : "draft",
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : nextOrder,
      startMs: body.startMs as number,
      endMs: body.endMs as number,
      status: typeof body.status === "string" ? body.status : "draft",
      confidence: typeof body.confidence === "number" ? body.confidence : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      blocks: (body.blocks as object[]) ?? [],
    })
    .returning();

  return c.json({ segment }, 201);
});

// PUT /:projectId/segments/:segId — update segment
timeline.put("/:projectId/segments/:segId", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("projectId");
  const segId = c.req.param("segId");

  const owned = await verifyProjectOwnership(projectId, userId);
  if (!owned) return c.json({ error: "Project not found" }, 404);

  const [existing] = await db
    .select({ id: segments.id })
    .from(segments)
    .where(and(eq(segments.id, segId), eq(segments.projectId, projectId)))
    .limit(1);

  if (!existing) return c.json({ error: "Segment not found" }, 404);

  let body: Record<string, unknown> = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const updates: Partial<typeof segments.$inferInsert> = {};
  if (typeof body.startMs === "number") updates.startMs = body.startMs;
  if (typeof body.endMs === "number") updates.endMs = body.endMs;
  if (typeof body.status === "string") updates.status = body.status;
  if (typeof body.notes === "string" || body.notes === null)
    updates.notes = body.notes as string | null;
  if (Array.isArray(body.blocks)) updates.blocks = body.blocks;
  if (typeof body.confidence === "number" || body.confidence === null)
    updates.confidence = body.confidence as number | null;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(segments)
    .set(updates)
    .where(eq(segments.id, segId))
    .returning();

  return c.json({ segment: updated });
});

// POST /:projectId/segments/:segId/split — split segment
timeline.post("/:projectId/segments/:segId/split", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("projectId");
  const segId = c.req.param("segId");

  const owned = await verifyProjectOwnership(projectId, userId);
  if (!owned) return c.json({ error: "Project not found" }, 404);

  const [seg] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.id, segId), eq(segments.projectId, projectId)))
    .limit(1);

  if (!seg) return c.json({ error: "Segment not found" }, 404);

  let body: { blockIndex?: number; texts?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.blockIndex !== "number" || !Array.isArray(body.texts)) {
    return c.json({ error: "blockIndex and texts are required" }, 400);
  }

  const { blockIndex, texts } = body;
  const blocks = (seg.blocks as object[]) ?? [];

  if (blockIndex < 0 || blockIndex >= blocks.length) {
    return c.json({ error: "blockIndex out of range" }, 400);
  }

  if (texts.length < 2) {
    return c.json({ error: "texts must contain at least 2 items" }, 400);
  }

  // Shift sort orders for segments after this one
  const following = await db
    .select({ id: segments.id, sortOrder: segments.sortOrder })
    .from(segments)
    .where(
      and(
        eq(segments.projectId, projectId),
        eq(segments.timelineKind, seg.timelineKind),
        gt(segments.sortOrder, seg.sortOrder),
      ),
    )
    .orderBy(asc(segments.sortOrder));

  // Shift existing following segments by (texts.length - 1) to make room
  const shift = texts.length - 1;
  for (const row of following) {
    await db
      .update(segments)
      .set({ sortOrder: row.sortOrder + shift, updatedAt: new Date() })
      .where(eq(segments.id, row.id));
  }

  // Calculate time per split (divide original duration equally)
  const totalMs = seg.endMs - seg.startMs;
  const splitDuration = Math.floor(totalMs / texts.length);

  const created: (typeof segments.$inferSelect)[] = [];

  // Update the original segment with first text
  const baseBlock = blocks[blockIndex] as Record<string, unknown>;
  const firstBlocks = [...blocks];
  (firstBlocks[blockIndex] as Record<string, unknown>) = {
    ...baseBlock,
    text: texts[0],
  };

  const [firstSeg] = await db
    .update(segments)
    .set({
      endMs: seg.startMs + splitDuration,
      blocks: firstBlocks,
      updatedAt: new Date(),
    })
    .where(eq(segments.id, segId))
    .returning();
  created.push(firstSeg);

  // Insert new segments for remaining texts
  for (let i = 1; i < texts.length; i++) {
    const newBlocks = [...blocks];
    (newBlocks[blockIndex] as Record<string, unknown>) = {
      ...baseBlock,
      text: texts[i],
    };
    const startMs = seg.startMs + splitDuration * i;
    const endMs = i === texts.length - 1 ? seg.endMs : startMs + splitDuration;

    const [newSeg] = await db
      .insert(segments)
      .values({
        projectId,
        timelineKind: seg.timelineKind,
        sortOrder: seg.sortOrder + i,
        startMs,
        endMs,
        status: seg.status,
        confidence: seg.confidence,
        notes: seg.notes,
        blocks: newBlocks,
      })
      .returning();
    created.push(newSeg);
  }

  return c.json({ segments: created }, 201);
});

// DELETE /:projectId/segments/:segId — delete segment, reorder subsequent
timeline.delete("/:projectId/segments/:segId", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("projectId");
  const segId = c.req.param("segId");

  const owned = await verifyProjectOwnership(projectId, userId);
  if (!owned) return c.json({ error: "Project not found" }, 404);

  const [seg] = await db
    .select({ id: segments.id, sortOrder: segments.sortOrder, timelineKind: segments.timelineKind })
    .from(segments)
    .where(and(eq(segments.id, segId), eq(segments.projectId, projectId)))
    .limit(1);

  if (!seg) return c.json({ error: "Segment not found" }, 404);

  await db.delete(segments).where(eq(segments.id, segId));

  // Shift subsequent sort orders down by 1
  const following = await db
    .select({ id: segments.id, sortOrder: segments.sortOrder })
    .from(segments)
    .where(
      and(
        eq(segments.projectId, projectId),
        eq(segments.timelineKind, seg.timelineKind),
        gt(segments.sortOrder, seg.sortOrder),
      ),
    )
    .orderBy(asc(segments.sortOrder));

  for (const row of following) {
    await db
      .update(segments)
      .set({ sortOrder: row.sortOrder - 1, updatedAt: new Date() })
      .where(eq(segments.id, row.id));
  }

  return c.json({ success: true });
});

// POST /:projectId/segments/approve — copy draft → approved
timeline.post("/:projectId/segments/approve", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("projectId");

  const owned = await verifyProjectOwnership(projectId, userId);
  if (!owned) return c.json({ error: "Project not found" }, 404);

  // Delete all existing approved segments
  await db
    .delete(segments)
    .where(
      and(
        eq(segments.projectId, projectId),
        eq(segments.timelineKind, "approved"),
      ),
    );

  // Fetch all draft segments ordered by sortOrder
  const drafts = await db
    .select()
    .from(segments)
    .where(
      and(
        eq(segments.projectId, projectId),
        eq(segments.timelineKind, "draft"),
      ),
    )
    .orderBy(asc(segments.sortOrder));

  if (drafts.length === 0) {
    return c.json({ segments: [] });
  }

  // Clone drafts as approved
  const approvedInserts = drafts.map((d) => ({
    projectId: d.projectId,
    timelineKind: "approved" as const,
    sortOrder: d.sortOrder,
    startMs: d.startMs,
    endMs: d.endMs,
    status: d.status,
    confidence: d.confidence,
    notes: d.notes,
    blocks: d.blocks,
  }));

  const approved = await db
    .insert(segments)
    .values(approvedInserts)
    .returning();

  return c.json({ segments: approved });
});

export default timeline;
