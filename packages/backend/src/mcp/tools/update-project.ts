import { z } from "zod";
import { getProject, updateProject } from "../api-client.js";
import type { ApiStyle, ApiPlacement } from "../api-client.js";

const StyleSchema = z.object({
  id: z.string().min(1).describe("Unique style identifier"),
  font: z.string().describe("Font ID (references a font defined in the project)"),
  size: z.number().int().positive().describe("Font size in pixels"),
  color: z
    .string()
    .optional()
    .describe("Text color as #RRGGBB"),
  outline_color: z
    .string()
    .optional()
    .describe("Outline color as #RRGGBB"),
  outline: z
    .number()
    .int()
    .optional()
    .describe("Outline width in pixels"),
  shadow_color: z
    .string()
    .optional()
    .describe("Shadow color as #RRGGBB or #RRGGBBAA"),
  shadow: z
    .number()
    .int()
    .optional()
    .describe("Shadow size in pixels"),
  text_bg: z
    .string()
    .optional()
    .describe("Background color behind the text as #RRGGBB or #RRGGBBAA"),
  text_bg_pad: z
    .number()
    .int()
    .optional()
    .describe("Padding inside the text background box in pixels"),
  text_bg_radius: z
    .number()
    .int()
    .optional()
    .describe("Corner radius of the text background box in pixels"),
  align: z
    .string()
    .optional()
    .describe('Text alignment: "left", "center", or "right"'),
  line_height: z
    .number()
    .int()
    .optional()
    .describe("Line height in pixels"),
});

const PlacementSchema = z.object({
  id: z.string().min(1).describe("Unique placement identifier"),
  anchor: z
    .string()
    .describe(
      "Anchor position: top-left|top-center|top-right|middle-left|center|middle-right|bottom-left|bottom-center|bottom-right",
    ),
  margin_x: z
    .number()
    .int()
    .optional()
    .describe("Horizontal margin from the anchor edge in pixels"),
  margin_y: z
    .number()
    .int()
    .optional()
    .describe("Vertical margin from the anchor edge in pixels"),
  max_width: z
    .number()
    .int()
    .optional()
    .describe("Maximum text box width in pixels"),
  max_height: z
    .number()
    .int()
    .optional()
    .describe("Maximum text box height in pixels"),
});

export const updateProjectInputSchema = {
  project_id: z.string().min(1).describe("The project UUID to update"),
  upsert_style: StyleSchema.optional().describe(
    "Add or replace a style by ID. Provide the full style object.",
  ),
  remove_style: z
    .string()
    .optional()
    .describe("ID of a style to remove from the project"),
  upsert_placement: PlacementSchema.optional().describe(
    "Add or replace a placement by ID. Provide the full placement object.",
  ),
  remove_placement: z
    .string()
    .optional()
    .describe("ID of a placement to remove from the project"),
};

export async function handleUpdateProject(input: {
  project_id: string;
  upsert_style?: ApiStyle;
  remove_style?: string;
  upsert_placement?: ApiPlacement;
  remove_placement?: string;
}) {
  const actions = [
    input.upsert_style,
    input.remove_style,
    input.upsert_placement,
    input.remove_placement,
  ].filter(Boolean);

  if (actions.length === 0) {
    throw new Error(
      "Exactly one of upsert_style, remove_style, upsert_placement, or remove_placement is required",
    );
  }
  if (actions.length > 1) {
    throw new Error(
      "Only one action per call: provide exactly one of upsert_style, remove_style, upsert_placement, or remove_placement",
    );
  }

  const project = await getProject(input.project_id);

  let action: string;
  let id: string;

  if (input.upsert_style) {
    const s = input.upsert_style;
    if (!s.id?.trim()) throw new Error("upsert_style.id is required");
    const styles = [...(project.styles ?? [])];
    const existingIdx = styles.findIndex((x) => x.id === s.id);
    if (existingIdx >= 0) {
      styles[existingIdx] = s;
    } else {
      styles.push(s);
    }
    await updateProject(input.project_id, { styles });
    action = "upsert_style";
    id = s.id;
  } else if (input.remove_style) {
    const styles = (project.styles ?? []).filter((x) => x.id !== input.remove_style);
    if (styles.length === (project.styles ?? []).length) {
      throw new Error(`Style "${input.remove_style}" not found`);
    }
    await updateProject(input.project_id, { styles });
    action = "remove_style";
    id = input.remove_style;
  } else if (input.upsert_placement) {
    const p = input.upsert_placement;
    if (!p.id?.trim()) throw new Error("upsert_placement.id is required");
    const placements = [...(project.placements ?? [])];
    const existingIdx = placements.findIndex((x) => x.id === p.id);
    if (existingIdx >= 0) {
      placements[existingIdx] = p;
    } else {
      placements.push(p);
    }
    await updateProject(input.project_id, { placements });
    action = "upsert_placement";
    id = p.id;
  } else {
    const placements = (project.placements ?? []).filter(
      (x) => x.id !== input.remove_placement,
    );
    if (placements.length === (project.placements ?? []).length) {
      throw new Error(`Placement "${input.remove_placement}" not found`);
    }
    await updateProject(input.project_id, { placements });
    action = "remove_placement";
    id = input.remove_placement!;
  }

  const output = {
    project_id: input.project_id,
    action,
    id,
    saved: true,
  };

  const text = `${action} "${id}" in project ${input.project_id}`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
