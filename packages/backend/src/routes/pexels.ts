import { Hono } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { savedSearches, libraryAssets } from "../db/schema.js";
import { getUserId } from "../middleware/auth.js";
import { uploadToR2 } from "../services/storage.js";
import {
  searchPhotos,
  searchVideos,
  downloadPexelsAsset,
  type PexelsPhoto,
  type PexelsVideo,
} from "../services/pexels.js";

type AuthEnv = { Variables: { userId: string } };

const router = new Hono<AuthEnv>();

function extFromContentType(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("mov")) return "mov";
  return "bin";
}

async function buildLibraryIds(
  userId: string,
  pexelsIds: string[]
): Promise<Record<string, string>> {
  if (pexelsIds.length === 0) return {};

  const rows = await db
    .select({ id: libraryAssets.id, pexelsId: libraryAssets.pexelsId })
    .from(libraryAssets)
    .where(
      and(
        eq(libraryAssets.userId, userId),
        inArray(libraryAssets.pexelsId, pexelsIds)
      )
    );

  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.pexelsId) {
      map[row.pexelsId] = row.id;
    }
  }
  return map;
}

// GET /photos
router.get("/photos", async (c) => {
  const userId = getUserId(c);
  const query = c.req.query("query") ?? "";
  const page = Number(c.req.query("page") ?? "1");
  const perPage = Number(c.req.query("per_page") ?? "20");

  if (!query) {
    return c.json({ error: "query parameter is required" }, 400);
  }

  const result = await searchPhotos(query, page, perPage);

  const pexelsIds = result.results.map((p) => String(p.id));
  const libraryIds = await buildLibraryIds(userId, pexelsIds);

  return c.json({
    photos: result.results,
    totalResults: result.total_results,
    libraryIds,
  });
});

// GET /videos
router.get("/videos", async (c) => {
  const userId = getUserId(c);
  const query = c.req.query("query") ?? "";
  const page = Number(c.req.query("page") ?? "1");
  const perPage = Number(c.req.query("per_page") ?? "20");

  if (!query) {
    return c.json({ error: "query parameter is required" }, 400);
  }

  const result = await searchVideos(query, page, perPage);

  const pexelsIds = result.results.map((v) => String(v.id));
  const libraryIds = await buildLibraryIds(userId, pexelsIds);

  return c.json({
    videos: result.results,
    totalResults: result.total_results,
    libraryIds,
  });
});

// POST /save
router.post("/save", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<{
    pexelsId: string;
    url: string;
    type: "photo" | "video";
    name?: string;
    photographer?: string;
  }>();

  const { pexelsId, url, type, name, photographer } = body;

  if (!pexelsId || !url || !type) {
    return c.json({ error: "pexelsId, url, and type are required" }, 400);
  }

  const { body: assetBody, contentType } = await downloadPexelsAsset(url);
  const ext = extFromContentType(contentType);
  const r2Key = `library/${userId}/assets/${type}/${pexelsId}.${ext}`;

  await uploadToR2(r2Key, assetBody, contentType);

  const assetName = name ?? `${type}-${pexelsId}`;
  const filename = `${pexelsId}.${ext}`;

  const metadata: Record<string, unknown> = {};
  if (photographer) metadata.photographer = photographer;
  metadata.pexelsUrl = url;

  const [asset] = await db
    .insert(libraryAssets)
    .values({
      userId,
      name: assetName,
      assetType: type,
      r2Key,
      filename,
      contentType,
      metadata,
      pexelsId,
      pexelsUrl: url,
    })
    .returning();

  return c.json({ asset });
});

// GET /searches
router.get("/searches", async (c) => {
  const userId = getUserId(c);

  const searches = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(savedSearches.createdAt);

  return c.json({ searches });
});

// POST /searches
router.post("/searches", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<{
    query: string;
    searchType?: string;
    resultCount?: number;
  }>();

  const { query, searchType, resultCount } = body;

  if (!query) {
    return c.json({ error: "query is required" }, 400);
  }

  const [search] = await db
    .insert(savedSearches)
    .values({
      userId,
      query,
      searchType: searchType ?? "photo",
      resultCount: resultCount ?? null,
    })
    .returning();

  return c.json({ search });
});

// DELETE /searches/:id
router.delete("/searches/:id", async (c) => {
  const userId = getUserId(c);
  const id = c.req.param("id");

  await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));

  return new Response(null, { status: 204 });
});

export default router;
