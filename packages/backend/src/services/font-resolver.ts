/**
 * Font resolution service.
 * Given a Font object from the project, resolves it to an absolute local file
 * path, downloading from R2 if necessary or falling back to fc-match.
 *
 * Ports verselineResolveSystemFontPath / verselineResolveRasterFace from
 * verseline_raster.go.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Font } from "@verseline/shared";
import { downloadFromR2 } from "./storage.js";

// ---- Cache ------------------------------------------------------------------

const fontPathCache = new Map<string, string>();

// Local directory where downloaded fonts are stored
const FONT_CACHE_DIR =
  process.env.FONT_CACHE_DIR ??
  path.join(os.tmpdir(), "verseline-fonts");

// ---- Public API -------------------------------------------------------------

/**
 * Resolve a Font to an absolute local file path.
 *
 * Resolution order:
 *   1. In-memory cache (keyed by font.id)
 *   2. On-disk cache in FONT_CACHE_DIR
 *   3. Download from R2 (key: projects/{projectId}/fonts/{filename})
 *   4. System font via `fc-match`
 *
 * Returns the path.  Throws if no path can be resolved.
 */
export async function resolveFontPath(
  font: Font,
  projectId: string,
): Promise<string> {
  const cacheKey = `${projectId}::${font.id}`;

  // 1. Memory cache
  const cached = fontPathCache.get(cacheKey);
  if (cached && fs.existsSync(cached)) {
    return cached;
  }

  // 2. / 3. Font files listed in the font definition
  if (font.files && font.files.length > 0) {
    for (const filePath of font.files) {
      // Try on-disk cache first
      const localCached = path.join(FONT_CACHE_DIR, path.basename(filePath));
      if (fs.existsSync(localCached)) {
        fontPathCache.set(cacheKey, localCached);
        return localCached;
      }

      // Try downloading from R2
      const r2Key = filePath.startsWith("fonts/")
        ? `projects/${projectId}/${filePath}`
        : `projects/${projectId}/fonts/${path.basename(filePath)}`;

      try {
        const downloaded = await downloadFontFromR2(r2Key, localCached);
        fontPathCache.set(cacheKey, downloaded);
        return downloaded;
      } catch {
        // R2 download failed, continue to next file / fallback
      }
    }
  }

  // 4. System font fallback via fc-match
  const family = font.family?.trim() ?? "";
  if (family) {
    try {
      const systemPath = await resolveSystemFontPath(family);
      fontPathCache.set(cacheKey, systemPath);
      return systemPath;
    } catch {
      // fc-match not available or font not found
    }
  }

  throw new Error(
    `Cannot resolve font "${font.id}" (family: "${font.family ?? ""}") for project ${projectId}`,
  );
}

// ---- Internal helpers -------------------------------------------------------

async function downloadFontFromR2(
  r2Key: string,
  localPath: string,
): Promise<string> {
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });

  const stream = await downloadFromR2(r2Key);
  const chunks: Buffer[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  const buf = Buffer.concat(chunks);
  await fs.promises.writeFile(localPath, buf);
  return localPath;
}

/**
 * Port of verselineResolveSystemFontPath from verseline_raster.go.
 * Spawns `fc-match -f '%{file}\n' "Family Name"` and returns the path.
 */
export async function resolveSystemFontPath(family: string): Promise<string> {
  const trimmed = family.trim();
  if (!trimmed) throw new Error("Font family is empty");

  const cached = fontPathCache.get(`__system::${trimmed}`);
  if (cached) return cached;

  const proc = Bun.spawnSync(["fc-match", "-f", "%{file}\n", trimmed], {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(
      `fc-match failed for "${trimmed}": ${proc.stderr?.toString().trim() ?? ""}`,
    );
  }

  const result = proc.stdout?.toString().trim() ?? "";
  if (!result) {
    throw new Error(`No system font file found for "${trimmed}"`);
  }

  fontPathCache.set(`__system::${trimmed}`, result);
  return result;
}
