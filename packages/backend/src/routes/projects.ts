import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects, segments } from "../db/schema.js";
import { getUserId } from "../middleware/auth.js";

type AuthEnv = {
  Variables: { userId: string };
};

const projectsRouter = new Hono<AuthEnv>();

// GET /projects — list user's projects
projectsRouter.get("/", async (c) => {
  const userId = getUserId(c);
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      canvas: projects.canvas,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(projects.createdAt);

  return c.json({ projects: rows });
});

// POST /projects — create project
projectsRouter.post("/", async (c) => {
  const userId = getUserId(c);

  let body: Record<string, unknown> = {};
  try {
    body = await c.req.json();
  } catch {
    // body optional, use defaults
  }

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "Untitled Project";

  const defaultCanvas = body.canvas ?? {
    width: 1920,
    height: 1080,
    fps: 30,
  };

  const defaultAssets = body.assets ?? {
    background: { path: "", type: "color" },
  };

  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name,
      canvas: defaultCanvas,
      assets: defaultAssets,
      fonts: (body.fonts as object[]) ?? [],
      styles: (body.styles as object[]) ?? [],
      placements: (body.placements as object[]) ?? [],
      sources: (body.sources as object[]) ?? [],
      overlays: (body.overlays as object[]) ?? [],
      renderProfiles: (body.renderProfiles as object[]) ?? [],
    })
    .returning();

  return c.json({ project }, 201);
});

// GET /projects/:id — get full project
projectsRouter.get("/:id", async (c) => {
  const userId = getUserId(c);
  const id = c.req.param("id");

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({ project });
});

// PUT /projects/:id — update project fields
projectsRouter.put("/:id", async (c) => {
  const userId = getUserId(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const allowedFields = [
    "name",
    "canvas",
    "assets",
    "fonts",
    "styles",
    "placements",
    "sources",
    "overlays",
    "renderProfiles",
  ] as const;

  const updates: Partial<typeof projects.$inferInsert> = {};
  for (const field of allowedFields) {
    if (field in body) {
      (updates as Record<string, unknown>)[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(projects)
    .set(updates)
    .where(eq(projects.id, id))
    .returning();

  return c.json({ project: updated });
});

// DELETE /projects/:id — delete project and its segments
projectsRouter.delete("/:id", async (c) => {
  const userId = getUserId(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  await db.delete(segments).where(eq(segments.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));

  return c.json({ success: true });
});

export default projectsRouter;
