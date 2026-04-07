import { Hono } from "hono";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects, segments } from "../db/schema.js";
import { getUserId } from "../middleware/auth.js";
import { downloadFromR2, uploadToR2 } from "../services/storage.js";
import {
  type VerselineFile,
  encodeVerseline,
  decodeVerseline,
  isVerselineBinary,
} from "@verseline/shared";

type AuthEnv = { Variables: { userId: string } };
const importExport = new Hono<AuthEnv>();

/** Read a ReadableStream into a Uint8Array. */
async function streamToBytes(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Guess a content type from a file extension. */
function mimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp3": return "audio/mpeg";
    case "wav": return "audio/wav";
    case "ogg": return "audio/ogg";
    case "mp4": return "video/mp4";
    case "webm": return "video/webm";
    case "png": return "image/png";
    case "jpg": case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

// POST /projects/import — import a .verseline binary file
importExport.post("/import", async (c) => {
  const userId = getUserId(c);
  const contentType = c.req.header("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "Expected multipart/form-data with a .verseline file" }, 400);
  }

  const form = await c.req.formData();
  const file = form.get("file") as File | null;
  if (!file) return c.json({ error: "file field is required" }, 400);

  const buf = new Uint8Array(await file.arrayBuffer());
  if (!isVerselineBinary(buf)) {
    return c.json({ error: "Not a valid .verseline binary file" }, 400);
  }

  const projectData = decodeVerseline(buf);

  // Create project in DB
  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name: projectData.name ?? "Imported Project",
      canvas: projectData.canvas,
      assets: projectData.assets,
      fonts: projectData.fonts,
      styles: projectData.styles,
      placements: projectData.placements,
      sources: projectData.sources,
      overlays: projectData.overlays,
      renderProfiles: projectData.render_profiles,
    })
    .returning();

  // Upload embedded assets to R2 and update project assets paths
  if (projectData.assets_data && Object.keys(projectData.assets_data).length > 0) {
    const assets = { ...(project.assets as any) };

    for (const [assetKey, assetBytes] of Object.entries(projectData.assets_data)) {
      const r2Key = `projects/${project.id}/${assetKey}`;
      await uploadToR2(r2Key, Buffer.from(assetBytes), mimeFromKey(assetKey));

      // Map the asset back to the project's assets field
      if (assetKey === assets.audio || assetKey.match(/^audio\./)) {
        assets.audio = r2Key;
      } else if (assetKey === assets.background?.path || assetKey.match(/^background\./)) {
        assets.background = { ...assets.background, path: r2Key };
      }
    }

    await db.update(projects).set({ assets }).where(eq(projects.id, project.id));
    project.assets = assets;
  }

  // Create segments
  if (projectData.segments.length > 0) {
    await db.insert(segments).values(
      projectData.segments.map((seg, i) => ({
        projectId: project.id,
        timelineKind: "draft",
        sortOrder: i,
        startMs: seg.start_ms,
        endMs: seg.end_ms,
        status: seg.status ?? "draft",
        confidence: seg.confidence ?? null,
        notes: seg.notes ?? null,
        blocks: seg.blocks,
      })),
    );
  }

  return c.json({ project }, 201);
});

// GET /projects/:id/export — export as .verseline binary with embedded assets
importExport.get("/:id/export", async (c) => {
  const userId = getUserId(c);
  const id = c.req.param("id");

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return c.json({ error: "Project not found" }, 404);

  const kind = c.req.query("timeline") ?? "draft";
  const segs = await db
    .select()
    .from(segments)
    .where(and(eq(segments.projectId, id), eq(segments.timelineKind, kind)))
    .orderBy(asc(segments.sortOrder));

  // Fetch source assets from R2 and embed them
  const assetsData: Record<string, Uint8Array> = {};
  const projectAssets = project.assets as any;

  if (projectAssets?.background?.path) {
    const bgPath = projectAssets.background.path as string;
    if (bgPath) {
      try {
        const bgKey = bgPath.split("/").pop() ?? bgPath;
        const stream = await downloadFromR2(bgPath);
        assetsData[bgKey] = await streamToBytes(stream);
      } catch {
        // Asset may not exist in R2 — skip embedding
      }
    }
  }

  if (projectAssets?.audio) {
    const audioPath = projectAssets.audio as string;
    if (audioPath) {
      try {
        const audioKey = audioPath.split("/").pop() ?? audioPath;
        const stream = await downloadFromR2(audioPath);
        assetsData[audioKey] = await streamToBytes(stream);
      } catch {
        // Asset may not exist in R2 — skip embedding
      }
    }
  }

  const fileData: VerselineFile = {
    version: 1,
    name: project.name,
    canvas: project.canvas as any,
    assets: project.assets as any,
    fonts: (project.fonts as any[]) ?? [],
    styles: (project.styles as any[]) ?? [],
    placements: (project.placements as any[]) ?? [],
    sources: (project.sources as any[]) ?? [],
    overlays: (project.overlays as any[]) ?? [],
    render_profiles: (project.renderProfiles as any[]) ?? [],
    segments: segs.map((s) => ({
      start_ms: s.startMs,
      end_ms: s.endMs,
      status: s.status,
      confidence: s.confidence ?? undefined,
      notes: s.notes ?? undefined,
      blocks: (s.blocks as any[]) ?? [],
    })),
    ...(Object.keys(assetsData).length > 0 ? { assets_data: assetsData } : {}),
  };

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  const bytes = encodeVerseline(fileData);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${slug}.verseline"`,
    },
  });
});

export default importExport;
