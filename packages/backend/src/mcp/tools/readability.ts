import { z } from "zod";
import { getProject, getSegments } from "../api-client.js";
import { findSegment } from "../helpers.js";
import type { ApiStyle, ApiPlacement, ApiBlock } from "../api-client.js";

export const readabilityInputSchema = {
  project_id: z.string().min(1).describe("The project UUID"),
  timeline: z
    .enum(["draft", "approved"])
    .optional()
    .default("draft")
    .describe('Timeline: "draft" (default) or "approved"'),
  segment_number: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based segment number (use this or segment_id)"),
  segment_id: z
    .string()
    .optional()
    .describe("Segment UUID (use this or segment_number)"),
  timestamp: z
    .string()
    .optional()
    .describe(
      "HH:MM:SS.mmm timestamp to sample background at. Defaults to segment midpoint.",
    ),
};

interface ReadabilityBlock {
  block_index: number;
  style_id: string;
  placement_id: string;
  text_color: string;
  contrast_ratio: number | null;
  meets_wcag_aa: boolean;
  meets_wcag_aaa: boolean;
  has_outline: boolean;
  has_shadow: boolean;
  has_text_bg: boolean;
  recommendations: string[];
  note: string;
}

/** Parse a hex color string (#RGB, #RRGGBB, #RRGGBBAA) to [r, g, b] 0-255. */
function parseHexColor(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    const r = parseInt(h[0]! + h[0]!, 16);
    const g = parseInt(h[1]! + h[1]!, 16);
    const b = parseInt(h[2]! + h[2]!, 16);
    return [r, g, b];
  }
  if (h.length >= 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

/** Compute relative luminance per WCAG 2.0. */
function relativeLuminance(r: number, g: number, b: number): number {
  const linearize = (c: number): number => {
    const sRGB = c / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Compute WCAG contrast ratio between two [r,g,b] colors. */
function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(...fg);
  const l2 = relativeLuminance(...bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export async function handleCheckReadability(input: {
  project_id: string;
  timeline?: "draft" | "approved";
  segment_number?: number;
  segment_id?: string;
  timestamp?: string;
}) {
  const timeline = input.timeline ?? "draft";

  const [project, allSegments] = await Promise.all([
    getProject(input.project_id),
    getSegments(input.project_id, timeline),
  ]);

  const [seg, idx] = findSegment(allSegments, input.segment_number, input.segment_id);

  const blocks = (seg.blocks ?? []) as ApiBlock[];
  const styleMap = new Map<string, ApiStyle>(
    (project.styles ?? []).map((s) => [s.id, s]),
  );
  const placementMap = new Map<string, ApiPlacement>(
    (project.placements ?? []).map((p) => [p.id, p]),
  );

  // Note: contrast ratio requires sampling the background image at the placement region.
  // Since this TypeScript MCP server does not have image-processing capabilities built in
  // (the Go binary does this via native image libraries), we return a structured analysis
  // based on the style configuration alone — flagging any styles that lack contrast aids
  // (outline, shadow, text_bg) alongside metadata for the caller to act on.
  //
  // For full pixel-level sampling, use the Go `verseline mcp` binary instead.

  const results: ReadabilityBlock[] = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi]!;
    const styleId = block.style ?? "";
    const placementId = block.placement ?? "";
    const style = styleMap.get(styleId);

    const hasOutline = !!(style?.outline && style.outline > 0 && style.outline_color);
    const hasShadow = !!(style?.shadow && style.shadow > 0);
    const hasTextBg = !!(style?.text_bg);

    const textColor = style?.color ?? "#ffffff";
    const textRGB = parseHexColor(textColor);

    // Attempt a rough contrast estimate against a neutral mid-gray background
    // as a fallback when we cannot sample the actual video background.
    let contrastRatioValue: number | null = null;
    let meetsAA = false;
    let meetsAAA = false;

    if (textRGB) {
      // Assume a mid-gray background (common for video; far from ideal but informative)
      const neutralBg: [number, number, number] = [128, 128, 128];
      contrastRatioValue = contrastRatio(textRGB, neutralBg);
      meetsAA = contrastRatioValue >= 3.0;
      meetsAAA = contrastRatioValue >= 4.5;
    }

    const recommendations: string[] = [];
    if (!hasOutline && !hasShadow && !hasTextBg) {
      recommendations.push(
        "Consider adding an outline (outline + outline_color), shadow, or text_bg to improve contrast against varying backgrounds",
      );
    }
    if (!hasOutline) {
      recommendations.push(
        `Add outline: set style.outline (e.g. 2) and style.outline_color (e.g. "#000000")`,
      );
    }
    if (!hasShadow) {
      recommendations.push(`Add shadow: set style.shadow (e.g. 3) on the style`);
    }
    if (!hasTextBg) {
      recommendations.push(
        `Add text_bg: set style.text_bg (e.g. "#000000CC") for a semi-transparent box behind text`,
      );
    }

    results.push({
      block_index: bi + 1,
      style_id: styleId,
      placement_id: placementId,
      text_color: textColor,
      contrast_ratio: contrastRatioValue !== null ? Math.round(contrastRatioValue * 100) / 100 : null,
      meets_wcag_aa: meetsAA,
      meets_wcag_aaa: meetsAAA,
      has_outline: hasOutline,
      has_shadow: hasShadow,
      has_text_bg: hasTextBg,
      recommendations: hasOutline || hasShadow || hasTextBg ? [] : recommendations,
      note:
        "Contrast ratio is estimated against a neutral gray — for pixel-accurate sampling use the verseline Go binary.",
    });
  }

  const poorCount = results.filter((r) => !r.meets_wcag_aa).length;

  const output = {
    project_id: input.project_id,
    timeline,
    segment_number: idx + 1,
    segment_id: seg.id,
    blocks: results,
  };

  const text =
    `Readability analysis for ${timeline} segment ${idx + 1}: ${results.length} block(s)` +
    (poorCount > 0 ? `, ${poorCount} with estimated poor contrast` : ", all pass estimated contrast check");

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
