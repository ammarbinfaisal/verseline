import { z } from "zod";
import { getProject, getSegments } from "../api-client.js";

export const inspectInputSchema = {
  project_id: z.string().min(1).describe("The project UUID to inspect"),
};

export async function handleInspectProject(input: { project_id: string }) {
  const [project, draftSegs, approvedSegs] = await Promise.all([
    getProject(input.project_id),
    getSegments(input.project_id, "draft"),
    getSegments(input.project_id, "approved"),
  ]);

  const styles: string[] = (project.styles ?? []).map((s) => s.id);
  const placements: string[] = (project.placements ?? []).map((p) => p.id);
  const sources: string[] = (project.sources ?? []).map((s) => s.id);
  const fonts: string[] = (project.fonts ?? []).map((f) => `${f.id} (${f.family})`);
  const renderProfiles: string[] = (project.renderProfiles ?? []).map((r) => r.id);

  const summary = {
    project_id: project.id,
    name: project.name,
    canvas: project.canvas,
    assets: project.assets,
    fonts,
    styles,
    placements,
    sources,
    render_profiles: renderProfiles,
    overlays_count: (project.overlays ?? []).length,
    draft_segment_count: draftSegs.length,
    approved_segment_count: approvedSegs.length,
  };

  const text =
    `Project "${project.name}" (${project.id}): ` +
    `${project.canvas.width}x${project.canvas.height} @ ${project.canvas.fps}fps, ` +
    `styles=[${styles.join(", ")}], placements=[${placements.join(", ")}], ` +
    `sources=[${sources.join(", ")}], profiles=[${renderProfiles.join(", ")}], ` +
    `draft_segments=${draftSegs.length}, approved_segments=${approvedSegs.length}`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(summary, null, 2) },
    ],
  };
}
