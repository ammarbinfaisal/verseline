/**
 * Hono router for render endpoints.
 *
 * POST /projects/:id/preview/:segIndex  — render preview for one segment
 * POST /projects/:id/render             — start async full render job
 * GET  /render/jobs/:jobId              — get render job status
 */
import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects, segments, renderJobs } from "../db/schema.js";
import { getUserId } from "../middleware/auth.js";
import { uploadToR2, getPresignedDownloadUrl } from "../services/storage.js";
import {
  renderPreview,
  renderProject,
  type ProjectRow,
  type SegmentRow,
} from "../services/renderer.js";
import * as fs from "node:fs";

type AuthEnv = {
  Variables: { userId: string };
};

const render = new Hono<AuthEnv>();

// ---- Helpers ----------------------------------------------------------------

async function loadProjectAndSegments(
  projectId: string,
  userId: string,
  timelineKind = "approved",
): Promise<{ project: ProjectRow; segs: SegmentRow[] } | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return null;

  const segs = await db
    .select()
    .from(segments)
    .where(
      and(
        eq(segments.projectId, projectId),
        eq(segments.timelineKind, timelineKind),
      ),
    )
    .orderBy(segments.sortOrder);

  // Map DB rows to the shape the renderer expects
  const projectRow: ProjectRow = {
    id: project.id,
    name: project.name,
    canvas: project.canvas as ProjectRow["canvas"],
    assets: project.assets as ProjectRow["assets"],
    fonts: (project.fonts as ProjectRow["fonts"]) ?? [],
    styles: (project.styles as ProjectRow["styles"]) ?? [],
    placements: (project.placements as ProjectRow["placements"]) ?? [],
    renderProfiles: (project.renderProfiles as ProjectRow["renderProfiles"]) ?? [],
  };

  const segRows: SegmentRow[] = segs.map((s) => ({
    id: s.id,
    sortOrder: s.sortOrder,
    startMs: s.startMs,
    endMs: s.endMs,
    blocks: (s.blocks as SegmentRow["blocks"]) ?? [],
  }));

  return { project: projectRow, segs: segRows };
}

// ---- POST /projects/:id/preview/:segIndex -----------------------------------
// Renders a single-segment preview, uploads the MP4 to R2, returns a presigned URL.

render.post("/:id/preview/:segIndex", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("id");
  const segIndexParam = c.req.param("segIndex");
  const segIndex = parseInt(segIndexParam, 10);

  if (isNaN(segIndex) || segIndex < 0) {
    return c.json({ error: "segIndex must be a non-negative integer" }, 400);
  }

  const loaded = await loadProjectAndSegments(projectId, userId, "draft");
  if (!loaded) {
    return c.json({ error: "Project not found" }, 404);
  }

  const { project, segs } = loaded;

  if (segIndex >= segs.length) {
    return c.json(
      { error: `segIndex ${segIndex} out of range (${segs.length} segments)` },
      400,
    );
  }

  let localPath: string;
  try {
    const result = await renderPreview(projectId, segIndex, project, segs);
    localPath = result.localPath;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Render failed: ${message}` }, 500);
  }

  // Upload to R2
  const r2Key = `projects/${projectId}/previews/segment-${String(segIndex + 1).padStart(3, "0")}.mp4`;
  try {
    const buf = await fs.promises.readFile(localPath);
    await uploadToR2(r2Key, buf, "video/mp4");
  } finally {
    // Clean up temp file
    fs.promises.rm(localPath, { force: true }).catch(() => {});
  }

  const url = await getPresignedDownloadUrl(r2Key, 3600);
  return c.json({ url, key: r2Key });
});

// ---- POST /projects/:id/render ----------------------------------------------
// Creates a render job and starts rendering in the background.

render.post("/:id/render", async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param("id");

  let body: { profileId?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // default profile
  }
  const profileId = (body.profileId ?? "default").trim() || "default";

  const loaded = await loadProjectAndSegments(projectId, userId, "approved");
  if (!loaded) {
    return c.json({ error: "Project not found" }, 404);
  }

  const { project, segs } = loaded;

  if (segs.length === 0) {
    return c.json(
      { error: "No approved segments found. Approve the timeline first." },
      400,
    );
  }

  // Create the render job record
  const [job] = await db
    .insert(renderJobs)
    .values({
      projectId,
      status: "pending",
      profileId,
      progress: 0,
    })
    .returning();

  // Start rendering in the background — do NOT await
  void (async () => {
    try {
      // Mark as running
      await db
        .update(renderJobs)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(renderJobs.id, job.id));

      const { localPath } = await renderProject(
        projectId,
        project,
        segs,
        profileId,
        async (percent) => {
          await db
            .update(renderJobs)
            .set({ progress: percent, updatedAt: new Date() })
            .where(eq(renderJobs.id, job.id));
        },
      );

      // Upload output to R2
      const suffix = profileId !== "default" ? `.${profileId}` : "";
      const baseName = (project.name ?? "verseline").replace(/[^a-zA-Z0-9_-]/g, "_");
      const r2Key = `projects/${projectId}/renders/${baseName}${suffix}.mp4`;

      const buf = await fs.promises.readFile(localPath);
      await uploadToR2(r2Key, buf, "video/mp4");
      fs.promises.rm(localPath, { force: true, recursive: true }).catch(() => {});

      await db
        .update(renderJobs)
        .set({
          status: "done",
          progress: 100,
          outputKey: r2Key,
          updatedAt: new Date(),
        })
        .where(eq(renderJobs.id, job.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[render job ${job.id}] failed:`, err);
      await db
        .update(renderJobs)
        .set({ status: "failed", error: message, updatedAt: new Date() })
        .where(eq(renderJobs.id, job.id));
    }
  })();

  return c.json({ jobId: job.id, status: "pending" }, 202);
});

// ---- GET /render/jobs/:jobId ------------------------------------------------

render.get("/jobs/:jobId", async (c) => {
  const userId = getUserId(c);
  const jobId = c.req.param("jobId");

  const [job] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.id, jobId))
    .limit(1);

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  // Verify the job belongs to a project owned by this user
  const [proj] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, job.projectId), eq(projects.userId, userId)),
    )
    .limit(1);

  if (!proj) {
    return c.json({ error: "Job not found" }, 404);
  }

  // If done, attach a short-lived presigned URL
  let downloadUrl: string | undefined;
  if (job.status === "done" && job.outputKey) {
    try {
      downloadUrl = await getPresignedDownloadUrl(job.outputKey, 3600);
    } catch {
      // non-fatal
    }
  }

  return c.json({
    job: {
      id: job.id,
      projectId: job.projectId,
      status: job.status,
      profileId: job.profileId,
      progress: job.progress,
      outputKey: job.outputKey,
      downloadUrl,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
  });
});

export default render;
