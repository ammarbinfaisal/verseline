import { z } from "zod";
import { getProject, updateProject } from "../api-client.js";

// Mapping from agent-facing target names to project field names
const TARGET_FIELD: Record<string, keyof {
  styles: unknown; placements: unknown; fonts: unknown; sources: unknown; renderProfiles: unknown;
}> = {
  style: "styles",
  placement: "placements",
  font: "fonts",
  source: "sources",
  render_profile: "renderProfiles",
};

export const updateProjectInputSchema = {
  project_id: z.string().min(1).describe("The project UUID to update"),
  target: z
    .enum(["style", "placement", "font", "source", "render_profile", "name", "canvas"])
    .describe(
      'What to update. "style"|"placement"|"font"|"source"|"render_profile" manage array items. "name" renames the project. "canvas" changes canvas dimensions.',
    ),
  action: z
    .enum(["upsert", "remove", "set"])
    .describe(
      '"upsert" adds or replaces an array item by id. "remove" deletes an array item by id. "set" is for name and canvas (non-array fields).',
    ),
  value: z
    .any()
    .optional()
    .describe(
      'For upsert: the full object to add/replace (must include "id"). For set name: a non-empty string. For set canvas: { width, height, fps } with all positive integers.',
    ),
  id: z
    .string()
    .optional()
    .describe('For remove: the id of the item to remove from the target array.'),
};

export async function handleUpdateProject(input: {
  project_id: string;
  target: "style" | "placement" | "font" | "source" | "render_profile" | "name" | "canvas";
  action: "upsert" | "remove" | "set";
  value?: unknown;
  id?: string;
}) {
  const { project_id, target, action, value, id } = input;

  const isArrayTarget = target in TARGET_FIELD;
  const isScalarTarget = target === "name" || target === "canvas";

  // Validate action/target combinations
  if (isArrayTarget && action === "set") {
    throw new Error(`action "set" is only valid for target "name" or "canvas", not "${target}"`);
  }
  if (isScalarTarget && (action === "upsert" || action === "remove")) {
    throw new Error(`action "${action}" is only valid for array targets (style/placement/font/source/render_profile), not "${target}"`);
  }

  const project = await getProject(project_id);

  let resultId: string;

  if (isArrayTarget) {
    const fieldName = TARGET_FIELD[target]!;
    const arr = ((project[fieldName as keyof typeof project] as unknown[]) ?? []) as Array<{ id: string }>;

    if (action === "upsert") {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`For upsert, value must be an object with an "id" field`);
      }
      const item = value as { id?: string };
      if (typeof item.id !== "string" || !item.id.trim()) {
        throw new Error(`value.id must be a non-empty string for upsert`);
      }
      const newArr = [...arr];
      const existingIdx = newArr.findIndex((x) => x.id === item.id);
      if (existingIdx >= 0) {
        newArr[existingIdx] = item as { id: string };
      } else {
        newArr.push(item as { id: string });
      }
      await updateProject(project_id, { [fieldName]: newArr } as Parameters<typeof updateProject>[1]);
      resultId = item.id;
    } else {
      // remove
      if (typeof id !== "string" || !id.trim()) {
        throw new Error(`"id" must be a non-empty string when action is "remove"`);
      }
      const filtered = arr.filter((x) => x.id !== id);
      if (filtered.length === arr.length) {
        throw new Error(`${target} "${id}" not found in project ${target}s`);
      }
      await updateProject(project_id, { [fieldName]: filtered } as Parameters<typeof updateProject>[1]);
      resultId = id;
    }
  } else if (target === "name") {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`For target "name" with action "set", value must be a non-empty string`);
    }
    await updateProject(project_id, { name: value.trim() });
    resultId = value.trim();
  } else {
    // canvas
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new Error(`For target "canvas" with action "set", value must be { width, height, fps }`);
    }
    const canvas = value as { width?: unknown; height?: unknown; fps?: unknown };
    if (
      typeof canvas.width !== "number" || !Number.isInteger(canvas.width) || canvas.width <= 0 ||
      typeof canvas.height !== "number" || !Number.isInteger(canvas.height) || canvas.height <= 0 ||
      typeof canvas.fps !== "number" || !Number.isInteger(canvas.fps) || canvas.fps <= 0
    ) {
      throw new Error(`canvas must have width, height, and fps as positive integers`);
    }
    await updateProject(project_id, {
      canvas: { width: canvas.width, height: canvas.height, fps: canvas.fps },
    });
    resultId = `${canvas.width}x${canvas.height}@${canvas.fps}`;
  }

  const output = {
    project_id,
    target,
    action,
    id: resultId,
    saved: true,
  };

  const text = `${action} ${target} "${resultId}" in project ${project_id}`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
