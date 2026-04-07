/**
 * Library asset routes (auth required, mounted under /library).
 *
 * GET    /                        — list user's library assets
 * POST   /upload-url              — generate a presigned R2 upload URL
 * POST   /confirm                 — confirm upload and create DB row
 * GET    /:id                     — get single asset with project usage
 * PUT    /:id                     — update name / metadata
 * DELETE /:id                     — delete asset and R2 object
 * POST   /:id/link/:projectId     — link asset to a project
 * DELETE /:id/link/:projectId     — unlink asset from a project
 * GET    /:id/proxy               — proxy the R2 asset to the client
 */

import { Hono } from "hono";
import { eq, and, ilike, sql, count } from "drizzle-orm";
import { db } from "../db/index.js";
import { libraryAssets, libraryAssetProjects, projects } from "../db/schema.js";
import { getUserId } from "../middleware/auth.js";
import {
  getPresignedUploadUrl,
  downloadFromR2,
  deleteFromR2,
} from "../services/storage.js";

type AuthEnv = {
  Variables: { userId: string };
};

const ASSET_TYPES = new Set(["audio", "background", "font", "image", "video"]);
const MIME_CONTENT_TYPE_RE = /^[\w.+-]+\/[\w.+-]+$/;

const libraryRouter = new Hono<AuthEnv>();

// ---- Helpers -----------------------------------------------------------------

/** Return the library asset if it belongs to the authenticated user, else null. */
async function getOwnedAsset(assetId: string, userId: string) {
  const [asset] = await db
    .select()
    .from(libraryAssets)
    .where(and(eq(libraryAssets.id, assetId), eq(libraryAssets.userId, userId)))
    .limit(1);
  return asset ?? null;
}

const EXT_CONTENT_TYPE: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

// ---- GET / -------------------------------------------------------------------

libraryRouter.get("/", async (c) => {
  const userId = getUserId(c);

  const rawType = c.req.query("type");
  const rawQ = c.req.query("q");
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions = [eq(libraryAssets.userId, userId)];

  if (typeof rawType === "string" && rawType.trim()) {
    if (!ASSET_TYPES.has(rawType.trim())) {
      return c.json({ error: `type must be one of: ${[...ASSET_TYPES].join(", ")}` }, 400);
    }
    conditions.push(eq(libraryAssets.assetType, rawType.trim()));
  }

  if (typeof rawQ === "string" && rawQ.trim()) {
    conditions.push(ilike(libraryAssets.name, `%${rawQ.trim()}%`));
  }

  const where = and(...conditions);

  const [assets, [{ total }]] = await Promise.all([
    db
      .select()
      .from(libraryAssets)
      .where(where)
      .orderBy(sql`${libraryAssets.createdAt} desc`)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(libraryAssets).where(where),
  ]);

  return c.json({ assets, total: Number(total) });
});

// ---- POST /upload-url --------------------------------------------------------

libraryRouter.post("/upload-url", async (c) => {
  const userId = getUserId(c);

  let body: { filename?: unknown; contentType?: unknown; assetType?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { filename, contentType, assetType } = body;

  if (typeof filename !== "string" || !filename.trim()) {
    return c.json({ error: "filename is required" }, 400);
  }
  if (typeof contentType !== "string" || !MIME_CONTENT_TYPE_RE.test(contentType)) {
    return c.json({ error: "contentType must be a valid MIME type" }, 400);
  }
  if (typeof assetType !== "string" || !ASSET_TYPES.has(assetType)) {
    return c.json({ error: `assetType must be one of: ${[...ASSET_TYPES].join(", ")}` }, 400);
  }

  const safeName = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `library/${userId}/assets/${assetType}/${safeName}`;

  const uploadUrl = await getPresignedUploadUrl(key, contentType, 900);

  return c.json({ uploadUrl, key });
});

// ---- POST /confirm -----------------------------------------------------------

libraryRouter.post("/confirm", async (c) => {
  const userId = getUserId(c);

  let body: {
    key?: unknown;
    assetType?: unknown;
    filename?: unknown;
    contentType?: unknown;
    name?: unknown;
    metadata?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { key, assetType, filename, contentType, name, metadata } = body;

  if (typeof key !== "string" || !key.trim()) {
    return c.json({ error: "key is required" }, 400);
  }
  if (typeof assetType !== "string" || !ASSET_TYPES.has(assetType)) {
    return c.json({ error: `assetType must be one of: ${[...ASSET_TYPES].join(", ")}` }, 400);
  }
  if (typeof filename !== "string" || !filename.trim()) {
    return c.json({ error: "filename is required" }, 400);
  }
  if (typeof contentType !== "string" || !MIME_CONTENT_TYPE_RE.test(contentType)) {
    return c.json({ error: "contentType must be a valid MIME type" }, 400);
  }

  // Prevent cross-user key tampering
  if (!key.startsWith(`library/${userId}/`)) {
    return c.json({ error: "key does not belong to this user" }, 400);
  }

  const resolvedName =
    typeof name === "string" && name.trim() ? name.trim() : filename.trim();

  const resolvedMetadata =
    metadata !== undefined && typeof metadata === "object" && metadata !== null
      ? metadata
      : undefined;

  const [asset] = await db
    .insert(libraryAssets)
    .values({
      userId,
      name: resolvedName,
      assetType,
      r2Key: key.trim(),
      filename: filename.trim(),
      contentType,
      ...(resolvedMetadata !== undefined ? { metadata: resolvedMetadata } : {}),
    })
    .returning();

  return c.json({ asset }, 201);
});

// ---- GET /:id ----------------------------------------------------------------

libraryRouter.get("/:id", async (c) => {
  const userId = getUserId(c);
  const assetId = c.req.param("id");

  const asset = await getOwnedAsset(assetId, userId);
  if (!asset) return c.json({ error: "Asset not found" }, 404);

  // Fetch linked projects
  const linkedProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(libraryAssetProjects)
    .innerJoin(projects, eq(libraryAssetProjects.projectId, projects.id))
    .where(eq(libraryAssetProjects.libraryAssetId, assetId));

  return c.json({ asset, projects: linkedProjects });
});

// ---- PUT /:id ----------------------------------------------------------------

libraryRouter.put("/:id", async (c) => {
  const userId = getUserId(c);
  const assetId = c.req.param("id");

  const asset = await getOwnedAsset(assetId, userId);
  if (!asset) return c.json({ error: "Asset not found" }, 404);

  let body: { name?: unknown; metadata?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { name, metadata } = body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return c.json({ error: "name must be a non-empty string" }, 400);
    }
    updates.name = name.trim();
  }

  if (metadata !== undefined) {
    if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
      return c.json({ error: "metadata must be a JSON object" }, 400);
    }
    updates.metadata = metadata;
  }

  const [updated] = await db
    .update(libraryAssets)
    .set(updates)
    .where(eq(libraryAssets.id, assetId))
    .returning();

  return c.json({ asset: updated });
});

// ---- DELETE /:id -------------------------------------------------------------

libraryRouter.delete("/:id", async (c) => {
  const userId = getUserId(c);
  const assetId = c.req.param("id");

  const asset = await getOwnedAsset(assetId, userId);
  if (!asset) return c.json({ error: "Asset not found" }, 404);

  // Remove join rows, R2 object, and DB row
  await db.delete(libraryAssetProjects).where(eq(libraryAssetProjects.libraryAssetId, assetId));
  await Promise.all([
    asset.r2Key ? deleteFromR2(asset.r2Key) : Promise.resolve(),
    db.delete(libraryAssets).where(eq(libraryAssets.id, assetId)),
  ]);

  return new Response(null, { status: 204 });
});

// ---- POST /:id/link/:projectId -----------------------------------------------

libraryRouter.post("/:id/link/:projectId", async (c) => {
  const userId = getUserId(c);
  const assetId = c.req.param("id");
  const projectId = c.req.param("projectId");

  const [asset, project] = await Promise.all([
    getOwnedAsset(assetId, userId),
    db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)
      .then(([row]) => row ?? null),
  ]);

  if (!asset) return c.json({ error: "Asset not found" }, 404);
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Insert link row (ignore conflict if already linked)
  await db
    .insert(libraryAssetProjects)
    .values({ libraryAssetId: assetId, projectId })
    .onConflictDoNothing();

  // Merge asset reference into project.assets JSON
  const currentAssets = (project.assets ?? {}) as Record<string, unknown>;
  const existingLibrary = Array.isArray(currentAssets.library)
    ? (currentAssets.library as string[])
    : [];

  if (!existingLibrary.includes(assetId)) {
    await db
      .update(projects)
      .set({
        assets: { ...currentAssets, library: [...existingLibrary, assetId] },
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));
  }

  return c.json({ linked: true });
});

// ---- DELETE /:id/link/:projectId ---------------------------------------------

libraryRouter.delete("/:id/link/:projectId", async (c) => {
  const userId = getUserId(c);
  const assetId = c.req.param("id");
  const projectId = c.req.param("projectId");

  const [asset, project] = await Promise.all([
    getOwnedAsset(assetId, userId),
    db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)
      .then(([row]) => row ?? null),
  ]);

  if (!asset) return c.json({ error: "Asset not found" }, 404);
  if (!project) return c.json({ error: "Project not found" }, 404);

  await db
    .delete(libraryAssetProjects)
    .where(
      and(
        eq(libraryAssetProjects.libraryAssetId, assetId),
        eq(libraryAssetProjects.projectId, projectId),
      ),
    );

  // Remove asset reference from project.assets JSON
  const currentAssets = (project.assets ?? {}) as Record<string, unknown>;
  if (Array.isArray(currentAssets.library)) {
    const updatedLibrary = (currentAssets.library as string[]).filter((id) => id !== assetId);
    await db
      .update(projects)
      .set({
        assets: { ...currentAssets, library: updatedLibrary },
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));
  }

  return new Response(null, { status: 204 });
});

// ---- GET /:id/proxy ----------------------------------------------------------

libraryRouter.get("/:id/proxy", async (c) => {
  const userId = getUserId(c);
  const assetId = c.req.param("id");

  const asset = await getOwnedAsset(assetId, userId);
  if (!asset) return c.json({ error: "Asset not found" }, 404);
  if (!asset.r2Key) return c.json({ error: "Asset has no file" }, 404);

  let stream: ReadableStream;
  try {
    stream = await downloadFromR2(asset.r2Key);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("NoSuchKey")) {
      return c.json({ error: "Asset not found in storage" }, 404);
    }
    throw err;
  }

  const ext = (asset.r2Key ?? "").split(".").pop()?.toLowerCase() ?? "";
  const contentType = EXT_CONTENT_TYPE[ext] ?? asset.contentType ?? "application/octet-stream";

  return new Response(stream, {
    headers: { "Content-Type": contentType },
  });
});

export default libraryRouter;
