import type { Block, Project, Segment } from "./types.js";
import { tsToMillis } from "./timestamps.js";

export function validateProject(project: Project): string | null {
  if (project.canvas.width <= 0 || project.canvas.height <= 0) {
    return `canvas width and height must be positive (got width=${project.canvas.width}, height=${project.canvas.height})`;
  }
  if (project.canvas.fps <= 0) {
    return `canvas fps must be positive (got fps=${project.canvas.fps})`;
  }
  if (!project.assets.background.path.trim()) {
    return "assets.background.path is required";
  }
  if (!project.timeline.draft?.trim() && !project.timeline.approved?.trim()) {
    return "at least one of timeline.draft or timeline.approved is required";
  }

  const idCheck = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (!id.trim()) return `${kind} ids must not be empty`;
      if (seen.has(id)) return `duplicate ${kind} id "${id}"`;
      seen.add(id);
    }
    return null;
  };

  let err: string | null;
  if ((err = idCheck("font", (project.fonts ?? []).map((f) => f.id)))) return err;
  if ((err = idCheck("style", (project.styles ?? []).map((s) => s.id)))) return err;
  if ((err = idCheck("placement", (project.placements ?? []).map((p) => p.id)))) return err;
  if ((err = idCheck("source", (project.sources ?? []).map((s) => s.id)))) return err;
  if ((err = idCheck("render profile", (project.render_profiles ?? []).map((r) => r.id)))) return err;

  for (let i = 0; i < (project.overlays ?? []).length; i++) {
    const blockErr = validateBlocks(project.overlays![i].blocks, `overlay ${i}`);
    if (blockErr) return blockErr;
  }

  for (const profile of project.render_profiles ?? []) {
    if ((profile.width ?? 0) < 0 || (profile.height ?? 0) < 0 || (profile.fps ?? 0) < 0) {
      return `render profile "${profile.id}" dimensions and fps must not be negative`;
    }
  }

  return null;
}

export function validateBlocks(blocks: Block[], scope: string): string | null {
  if (blocks.length === 0) {
    return `${scope}: at least one block is required`;
  }
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block.text?.trim() && !block.source) {
      return `${scope} block ${i}: either text or source is required`;
    }
    if (block.source && !block.source.source.trim()) {
      return `${scope} block ${i}: source.source is required`;
    }
  }
  return null;
}

export function validateSegments(segments: Segment[]): string | null {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg.start.trim() || !seg.end.trim()) {
      return `segment ${i}: start and end are required`;
    }
    try {
      tsToMillis(seg.start);
    } catch {
      return `segment ${i}: invalid start timestamp`;
    }
    try {
      tsToMillis(seg.end);
    } catch {
      return `segment ${i}: invalid end timestamp`;
    }
    if (seg.blocks.length === 0) {
      return `segment ${i}: at least one block is required`;
    }
    const blockErr = validateBlocks(seg.blocks, `segment ${i}`);
    if (blockErr) return blockErr;
  }
  return null;
}

export function validateSegmentsAgainstProject(
  project: Project,
  segments: Segment[],
): string | null {
  const styleIds = new Set((project.styles ?? []).map((s) => s.id));
  const placementIds = new Set((project.placements ?? []).map((p) => p.id));
  const sourceIds = new Set((project.sources ?? []).map((s) => s.id));

  for (let i = 0; i < segments.length; i++) {
    for (let j = 0; j < segments[i].blocks.length; j++) {
      const block = segments[i].blocks[j];
      if (block.style && !styleIds.has(block.style)) {
        return `segment ${i} block ${j}: unknown style "${block.style}"`;
      }
      if (block.placement && !placementIds.has(block.placement)) {
        return `segment ${i} block ${j}: unknown placement "${block.placement}"`;
      }
      if (block.source && !sourceIds.has(block.source.source)) {
        return `segment ${i} block ${j}: unknown source "${block.source.source}"`;
      }
    }
  }
  return null;
}
