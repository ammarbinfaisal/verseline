import { Hono } from "hono";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects, segments } from "../db/schema.js";
import { getUserId } from "../middleware/auth.js";
import {
  tsToMillis,
  isLegacyProject,
  UnifiedFormatSchema,
  type VerselineFile,
  encodeVerseline,
  decodeVerseline,
  isVerselineBinary,
} from "@verseline/shared";

type AuthEnv = { Variables: { userId: string } };
const importExport = new Hono<AuthEnv>();

// POST /projects/import — import from .verseline, .verseline.json, or legacy project.json + timeline.jsonl
importExport.post("/import", async (c) => {
  const userId = getUserId(c);
  const contentType = c.req.header("content-type") ?? "";

  let projectData: VerselineFile;

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData();
    const format = form.get("format") as string | null;
    const file = form.get("file") as File | null;

    if (format === "legacy" || (!format && form.has("project"))) {
      // Legacy: project.json + timeline.jsonl
      const projectFile = (form.get("project") ?? file) as File | null;
      const timelineFile = form.get("timeline") as File | null;
      if (!projectFile) return c.json({ error: "project file is required" }, 400);

      const projJson = JSON.parse(await projectFile.text());
      let segs: { start: string; end: string; status?: string; confidence?: number; notes?: string; blocks: unknown[] }[] = [];

      if (timelineFile) {
        const text = await timelineFile.text();
        const trimmed = text.trim();
        if (trimmed.startsWith("[")) {
          segs = JSON.parse(trimmed);
        } else {
          for (const line of trimmed.split("\n")) {
            const l = line.trim();
            if (l) segs.push(JSON.parse(l));
          }
        }
      }

      projectData = {
        version: 1,
        name: projJson.name ?? "Imported Project",
        canvas: projJson.canvas,
        assets: projJson.assets,
        fonts: projJson.fonts ?? [],
        styles: projJson.styles ?? [],
        placements: projJson.placements ?? [],
        sources: projJson.sources ?? [],
        overlays: projJson.overlays ?? [],
        render_profiles: projJson.render_profiles ?? [],
        segments: segs.map((s) => ({
          id: (s as any).id,
          start_ms: tsToMillis(s.start),
          end_ms: tsToMillis(s.end),
          status: s.status,
          confidence: s.confidence,
          notes: s.notes,
          blocks: s.blocks as any[],
        })),
      };
    } else {
      // Unified or binary
      if (!file) return c.json({ error: "file is required" }, 400);
      const buf = new Uint8Array(await file.arrayBuffer());

      if (isVerselineBinary(buf)) {
        projectData = decodeVerseline(buf);
      } else {
        const json = JSON.parse(new TextDecoder().decode(buf));
        if (isLegacyProject(json)) {
          return c.json({ error: "This looks like a legacy project.json. Use format=legacy and include the timeline file." }, 400);
        }
        const parsed = UnifiedFormatSchema.parse(json);
        projectData = {
          version: 1,
          name: parsed.name ?? "Imported Project",
          canvas: parsed.canvas,
          assets: parsed.assets,
          fonts: parsed.fonts ?? [],
          styles: parsed.styles ?? [],
          placements: parsed.placements ?? [],
          sources: parsed.sources ?? [],
          overlays: parsed.overlays ?? [],
          render_profiles: parsed.render_profiles ?? [],
          segments: parsed.segments.map((s) => ({
            id: s.id,
            start_ms: tsToMillis(s.start),
            end_ms: tsToMillis(s.end),
            status: s.status,
            confidence: s.confidence,
            notes: s.notes,
            blocks: s.blocks as any[],
          })),
        };
      }
    }
  } else {
    // JSON body (unified format)
    const body = await c.req.json();
    if (isLegacyProject(body)) {
      return c.json({ error: "Legacy format requires multipart upload with project + timeline files." }, 400);
    }
    const parsed = UnifiedFormatSchema.parse(body);
    projectData = {
      version: 1,
      name: parsed.name ?? "Imported Project",
      canvas: parsed.canvas,
      assets: parsed.assets,
      fonts: parsed.fonts ?? [],
      styles: parsed.styles ?? [],
      placements: parsed.placements ?? [],
      sources: parsed.sources ?? [],
      overlays: parsed.overlays ?? [],
      render_profiles: parsed.render_profiles ?? [],
      segments: parsed.segments.map((s) => ({
        id: s.id,
        start_ms: tsToMillis(s.start),
        end_ms: tsToMillis(s.end),
        status: s.status,
        confidence: s.confidence,
        notes: s.notes,
        blocks: s.blocks as any[],
      })),
    };
  }

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

// GET /projects/:id/export — export as .verseline binary
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
