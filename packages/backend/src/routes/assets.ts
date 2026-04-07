/**
 * Asset management routes (auth required, mounted under /projects).
 *
 * POST /projects/:id/assets/upload-url  — generate a presigned R2 upload URL
 * POST /projects/:id/assets/confirm     — confirm upload and update project assets
 * GET  /projects/:id/assets/:key        — proxy/serve an asset from R2
 */

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";
import { getUserId } from "../middleware/auth.js";
import {
  getPresignedUploadUrl,
  downloadFromR2,
} from "../services/storage.js";

type AuthEnv = {
  Variables: { userId: string };
};

const ASSET_TYPES = new Set(["audio", "background", "font"]);
const MIME_CONTENT_TYPE_RE = /^[\w.+-]+\/[\w.+-]+$/;

const assetsRouter = new Hono<AuthEnv>();

// ---- Helpers -----------------------------------------------------------------

/** Verify project ownership and return the project row, or null. */
async function getOwnedProject(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return project ?? null;
}

// ---- POST /projects/:id/assets/upload-url ------------------------------------

assetsRouter.post("/:id/assets/upload-url", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("id");

  const project = await getOwnedProject(projectId, userId);
  if (!project) return c.json({ error: "Project not found" }, 404);

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

  // Sanitise the filename to avoid path traversal
  const safeName = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `projects/${projectId}/assets/${assetType}/${safeName}`;

  const uploadUrl = await getPresignedUploadUrl(key, contentType, 900);

  return c.json({ uploadUrl, key });
});

// ---- POST /projects/:id/assets/confirm ---------------------------------------

assetsRouter.post("/:id/assets/confirm", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("id");

  const project = await getOwnedProject(projectId, userId);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: { key?: unknown; assetType?: unknown; filename?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { key, assetType, filename } = body;

  if (typeof key !== "string" || !key.trim()) {
    return c.json({ error: "key is required" }, 400);
  }
  if (typeof assetType !== "string" || !ASSET_TYPES.has(assetType)) {
    return c.json({ error: `assetType must be one of: ${[...ASSET_TYPES].join(", ")}` }, 400);
  }
  if (typeof filename !== "string" || !filename.trim()) {
    return c.json({ error: "filename is required" }, 400);
  }

  // Ensure the key belongs to this project to prevent cross-project tampering
  if (!key.startsWith(`projects/${projectId}/`)) {
    return c.json({ error: "key does not belong to this project" }, 400);
  }

  const currentAssets = (project.assets ?? {}) as Record<string, unknown>;
  let updatedAssets: Record<string, unknown>;

  if (assetType === "audio") {
    updatedAssets = {
      ...currentAssets,
      audio: {
        ...(typeof currentAssets.audio === "object" && currentAssets.audio !== null
          ? (currentAssets.audio as Record<string, unknown>)
          : {}),
        path: key,
        filename: filename.trim(),
      },
    };
  } else if (assetType === "background") {
    const existingBg =
      typeof currentAssets.background === "object" && currentAssets.background !== null
        ? (currentAssets.background as Record<string, unknown>)
        : { type: "image" };
    updatedAssets = {
      ...currentAssets,
      background: {
        ...existingBg,
        path: key,
        filename: filename.trim(),
        type: "image",
      },
    };
  } else {
    // font — store in fonts array by convention
    const existingFonts = Array.isArray(currentAssets.fonts) ? currentAssets.fonts : [];
    updatedAssets = {
      ...currentAssets,
      fonts: [
        ...existingFonts,
        { path: key, filename: filename.trim() },
      ],
    };
  }

  const [updated] = await db
    .update(projects)
    .set({ assets: updatedAssets, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning({ id: projects.id, assets: projects.assets });

  return c.json({ success: true, assets: updated.assets });
});

// ---- GET /projects/:id/assets/:key ------------------------------------------
// Proxies the asset from R2 back to the client.
// Useful when presigned URLs are not viable (e.g., server-side rendering).

assetsRouter.get("/:id/assets/:key{.+}", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("id");

  const project = await getOwnedProject(projectId, userId);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const keyParam = c.req.param("key");
  const key = `projects/${projectId}/assets/${keyParam}`;

  let stream: ReadableStream;
  try {
    stream = await downloadFromR2(key);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("NoSuchKey")) {
      return c.json({ error: "Asset not found" }, 404);
    }
    throw err;
  }

  // Infer a basic content-type from the key extension
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const contentTypeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
  };
  const contentType = contentTypeMap[ext] ?? "application/octet-stream";

  return new Response(stream, {
    headers: { "Content-Type": contentType },
  });
});

export default assetsRouter;
