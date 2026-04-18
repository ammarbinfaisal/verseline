import { z } from "zod";
import { listLibraryAssets, linkLibraryAsset, unlinkLibraryAsset } from "../api-client.js";

// ---- libraryList ----

export const libraryListInputSchema = {
  type: z
    .enum(["audio", "background", "font", "image", "video"])
    .optional()
    .describe('Filter by asset type: "audio", "background", "font", "image", or "video". Omit for all types.'),
  q: z
    .string()
    .optional()
    .describe("Fuzzy name search query. Case-insensitive substring match."),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe("Page number (1-based, default: 1)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Results per page (default: 20, max: 100)"),
};

export async function handleLibraryList(input: {
  type?: "audio" | "background" | "font" | "image" | "video";
  q?: string;
  page?: number;
  limit?: number;
}) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const result = await listLibraryAssets({
    type: input.type,
    q: input.q,
    page,
    limit,
  });

  const assets = result.assets.map((a) => ({
    id: a.id,
    name: a.name,
    asset_type: a.assetType,
    r2_key: a.r2Key,
    content_type: a.contentType,
    metadata: a.metadata,
    pexels_id: a.pexelsId,
    created_at: a.createdAt,
  }));

  const output = {
    assets,
    total: result.total,
    page,
    limit,
    has_more: page * limit < result.total,
  };

  const text = `Listed ${assets.length} of ${result.total} library asset${result.total === 1 ? "" : "s"}${input.type ? ` (type: ${input.type})` : ""}${input.q ? ` matching "${input.q}"` : ""}`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}

// ---- libraryLink ----

export const libraryLinkInputSchema = {
  asset_id: z.string().min(1).describe("The library asset UUID"),
  project_id: z.string().min(1).describe("The project UUID"),
  action: z
    .enum(["link", "unlink"])
    .describe('"link" adds the asset to the project; "unlink" removes it. The asset stays in the library either way.'),
};

export async function handleLibraryLink(input: {
  asset_id: string;
  project_id: string;
  action: "link" | "unlink";
}) {
  if (input.action === "link") {
    await linkLibraryAsset(input.asset_id, input.project_id);
  } else {
    await unlinkLibraryAsset(input.asset_id, input.project_id);
  }

  const output = {
    asset_id: input.asset_id,
    project_id: input.project_id,
    action: input.action,
    success: true,
  };

  const verb = input.action === "link" ? "Linked" : "Unlinked";
  const prep = input.action === "link" ? "to" : "from";
  const text = `${verb} asset ${input.asset_id} ${prep} project ${input.project_id}`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
