export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  user: { name: string; url: string };
  video_files: {
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }[];
}

export interface PexelsSearchResult<T> {
  page: number;
  per_page: number;
  total_results: number;
  results: T[];
  next_page?: string;
}

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry<unknown>>();

function getApiKey(): string {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    throw new Error("PEXELS_API_KEY environment variable is not set");
  }
  return key;
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

export async function searchPhotos(
  query: string,
  page: number = 1,
  perPage: number = 20
): Promise<PexelsSearchResult<PexelsPhoto>> {
  const cacheKey = `photos:${query}:${page}:${perPage}`;
  const cached = getCached<PexelsSearchResult<PexelsPhoto>>(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const response = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    throw new Error(`Pexels photo search failed: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as {
    page: number;
    per_page: number;
    total_results: number;
    photos: PexelsPhoto[];
    next_page?: string;
  };

  const result: PexelsSearchResult<PexelsPhoto> = {
    page: raw.page,
    per_page: raw.per_page,
    total_results: raw.total_results,
    results: raw.photos,
    next_page: raw.next_page,
  };

  setCache(cacheKey, result);
  return result;
}

export async function searchVideos(
  query: string,
  page: number = 1,
  perPage: number = 20
): Promise<PexelsSearchResult<PexelsVideo>> {
  const cacheKey = `videos:${query}:${page}:${perPage}`;
  const cached = getCached<PexelsSearchResult<PexelsVideo>>(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const response = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    throw new Error(`Pexels video search failed: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as {
    page: number;
    per_page: number;
    total_results: number;
    videos: PexelsVideo[];
    next_page?: string;
  };

  const result: PexelsSearchResult<PexelsVideo> = {
    page: raw.page,
    per_page: raw.per_page,
    total_results: raw.total_results,
    results: raw.videos,
    next_page: raw.next_page,
  };

  setCache(cacheKey, result);
  return result;
}

export async function downloadPexelsAsset(
  url: string
): Promise<{ body: Buffer; contentType: string }> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download Pexels asset: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  return { body, contentType };
}
