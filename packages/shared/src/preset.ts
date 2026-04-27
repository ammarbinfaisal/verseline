import { z } from "zod";
import { StyleSchema, PlacementSchema, FontSchema } from "./types";

/**
 * Preset library kinds.
 *
 * The shared library is the second tier of reuse (after project-local). A
 * preset is a Style / Placement / Font row that the user can pick into any
 * project, plus built-in rows (userId = null) that ship with the product.
 *
 * See /design.md §8 (tiers) and §V2 (server migration plan).
 */

export const PresetKindSchema = z.enum(["style", "placement", "font"]);
export type PresetKind = z.infer<typeof PresetKindSchema>;

/**
 * The payload column matches one of the project-level shared schemas exactly.
 * Validating with `discriminatedUnion`-by-kind would be cleaner but the kind
 * lives on the row, not in the payload — so we validate after dispatch on
 * the row's `kind` field instead. This schema is the union for response typing.
 */
export const PresetPayloadSchema = z.union([
  StyleSchema,
  PlacementSchema,
  FontSchema,
]);
export type PresetPayload = z.infer<typeof PresetPayloadSchema>;

export const PresetRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  kind: PresetKindSchema,
  payload: PresetPayloadSchema,
  builtIn: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PresetRecord = z.infer<typeof PresetRecordSchema>;

/**
 * Validate a payload against the schema for a given preset kind.
 * Returns the parsed object (which strips unknown keys) or throws.
 */
export function validatePresetPayload(
  kind: PresetKind,
  payload: unknown,
): PresetPayload {
  switch (kind) {
    case "style":
      return StyleSchema.parse(payload);
    case "placement":
      return PlacementSchema.parse(payload);
    case "font":
      return FontSchema.parse(payload);
  }
}
