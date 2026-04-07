import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { uploadToR2, downloadFromR2, getPresignedDownloadUrl } from "./storage.js";

export interface GoogleFontMeta {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
  lastModified: string;
}

export interface GoogleFontDownloadResult {
  family: string;
  variant: string;
  r2Key: string;
  localPath: string;
}

// Raw shape returned by fonts.google.com/metadata/fonts
interface RawFontItem {
  family: string;
  category: string;
  fonts: Record<string, unknown>;
  subsets: string[];
  lastModified: string;
  [key: string]: unknown;
}

interface FontsMetadata {
  familyMetadataList: RawFontItem[];
}

// In-memory cache with 1-hour TTL
let metadataCache: GoogleFontMeta[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Map Google Fonts "fonts" keys to readable variant names.
// Keys follow the pattern: "0s400" (regular), "0s700" (bold), "1s400" (italic), "1s700" (bold italic), etc.
function parseFontsKeys(fontsObj: Record<string, unknown>): string[] {
  const variants: string[] = [];
  for (const key of Object.keys(fontsObj)) {
    // Key format: "{italic flag}s{weight}"
    const match = key.match(/^(\d+)s(\d+)$/);
    if (!match) continue;
    const isItalic = match[1] !== "0";
    const weight = match[2];
    if (weight === "400" && !isItalic) {
      variants.push("regular");
    } else if (weight === "400" && isItalic) {
      variants.push("italic");
    } else if (weight === "700" && !isItalic) {
      variants.push("bold");
    } else if (weight === "700" && isItalic) {
      variants.push("700italic");
    } else {
      variants.push(isItalic ? `${weight}italic` : weight);
    }
  }
  return variants.length > 0 ? variants : ["regular"];
}

export async function fetchFontsMetadata(): Promise<GoogleFontMeta[]> {
  const now = Date.now();
  if (metadataCache && now < cacheExpiresAt) {
    return metadataCache;
  }

  const res = await fetch("https://fonts.google.com/metadata/fonts", {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) {
    throw new Error(`Google Fonts metadata fetch failed: ${res.status} ${res.statusText}`);
  }

  // The response starts with ")]}'" which needs to be stripped (XSSI protection)
  const text = await res.text();
  const jsonText = text.startsWith(")]}'") ? text.slice(4) : text;
  const data: FontsMetadata = JSON.parse(jsonText);

  const fonts: GoogleFontMeta[] = data.familyMetadataList.map((item) => ({
    family: item.family,
    category: item.category,
    variants: parseFontsKeys(item.fonts),
    subsets: item.subsets,
    lastModified: item.lastModified,
  }));

  metadataCache = fonts;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return fonts;
}

const VALID_CATEGORIES = new Set(["serif", "sans-serif", "display", "handwriting", "monospace"]);

export async function searchFonts(
  query?: string,
  category?: string,
  limit = 20,
): Promise<GoogleFontMeta[]> {
  const all = await fetchFontsMetadata();
  let results = all;

  if (query) {
    const q = query.toLowerCase();
    results = results.filter((f) => f.family.toLowerCase().includes(q));
  }

  if (category && VALID_CATEGORIES.has(category)) {
    results = results.filter((f) => f.category === category);
  }

  return results.slice(0, limit);
}

export async function getVariantsForFamily(family: string): Promise<string[]> {
  const all = await fetchFontsMetadata();
  const font = all.find((f) => f.family.toLowerCase() === family.toLowerCase());
  if (!font) {
    throw new Error(`Font family not found: ${family}`);
  }
  return font.variants;
}

// Convert variant name to a weight number for the Google Fonts CSS API.
// e.g. "regular" -> "400", "bold" -> "700", "700italic" -> "700", "italic" -> "400"
function variantToWeight(variant: string): string {
  if (variant === "regular" || variant === "italic") return "400";
  if (variant === "bold") return "700";
  // Numeric prefix like "600" or "600italic"
  const m = variant.match(/^(\d+)/);
  return m ? m[1] : "400";
}

async function fetchTtfUrl(family: string, variant: string): Promise<string> {
  const weight = variantToWeight(variant);
  const isItalic = variant.endsWith("italic") && variant !== "italic" ? true : variant === "italic";
  const axisTag = isItalic ? "ital,wght@1," : "wght@";
  const encodedFamily = encodeURIComponent(family);
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedFamily}:${axisTag}${weight}`;

  const res = await fetch(cssUrl, {
    headers: {
      // Mozilla UA gets .ttf URLs; modern Chrome gets .woff2
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
    },
  });

  if (!res.ok) {
    throw new Error(`Google Fonts CSS fetch failed: ${res.status} ${res.statusText}`);
  }

  const css = await res.text();
  // Extract the src url(...) pointing to a .ttf file
  const ttfMatch = css.match(/src:\s*url\(([^)]+\.ttf)\)/);
  if (!ttfMatch) {
    throw new Error(`Could not find .ttf URL in Google Fonts CSS for ${family} ${variant}`);
  }
  return ttfMatch[1];
}

function r2KeyFor(family: string, variant: string): string {
  // Normalise family name to a safe path segment: "Noto Sans" -> "Noto_Sans"
  const safeFamily = family.replace(/\s+/g, "_");
  return `google-fonts/${safeFamily}/${variant}.ttf`;
}

async function r2Exists(key: string): Promise<boolean> {
  try {
    await downloadFromR2(key);
    return true;
  } catch {
    return false;
  }
}

export async function downloadGoogleFont(
  family: string,
  variant = "regular",
): Promise<GoogleFontDownloadResult> {
  const key = r2KeyFor(family, variant);

  // Check R2 first to avoid redundant downloads
  let alreadyCached = false;
  try {
    // A quick existence probe — if it doesn't throw we have the file
    const stream = await downloadFromR2(key);
    // We still need a local temp file for rendering; write it out
    const tmpPath = path.join(os.tmpdir(), `gf_${key.replace(/\//g, "_")}`);
    const chunks: Buffer[] = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    fs.writeFileSync(tmpPath, Buffer.concat(chunks));
    alreadyCached = true;
    return { family, variant, r2Key: key, localPath: tmpPath };
  } catch {
    // Not in R2 yet — proceed to download
  }

  if (alreadyCached) {
    // Unreachable, but satisfies TypeScript
    throw new Error("Unexpected state");
  }

  // Fetch the .ttf URL from the CSS API
  const ttfUrl = await fetchTtfUrl(family, variant);

  // Download the actual font binary
  const fontRes = await fetch(ttfUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!fontRes.ok) {
    throw new Error(`Font download failed: ${fontRes.status} ${fontRes.statusText}`);
  }

  const fontBuffer = Buffer.from(await fontRes.arrayBuffer());

  // Write to local temp file
  const tmpPath = path.join(os.tmpdir(), `gf_${key.replace(/\//g, "_")}`);
  fs.writeFileSync(tmpPath, fontBuffer);

  // Upload to R2
  await uploadToR2(key, fontBuffer, "font/ttf");

  return { family, variant, r2Key: key, localPath: tmpPath };
}

export async function getCachedGoogleFont(
  family: string,
  variant = "regular",
): Promise<{ r2Key: string; presignedUrl: string; localPath: string }> {
  const key = r2KeyFor(family, variant);

  // Check R2
  let inR2 = false;
  try {
    const stream = await downloadFromR2(key);
    inR2 = true;
    // Write to local temp for rendering
    const tmpPath = path.join(os.tmpdir(), `gf_${key.replace(/\//g, "_")}`);
    const chunks: Buffer[] = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    fs.writeFileSync(tmpPath, Buffer.concat(chunks));
    const presignedUrl = await getPresignedDownloadUrl(key);
    return { r2Key: key, presignedUrl, localPath: tmpPath };
  } catch {
    if (inR2) throw new Error("Failed to process cached font from R2");
  }

  // Not cached — download and cache it
  const result = await downloadGoogleFont(family, variant);
  const presignedUrl = await getPresignedDownloadUrl(result.r2Key);
  return { r2Key: result.r2Key, presignedUrl, localPath: result.localPath };
}
