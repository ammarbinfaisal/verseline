import { pack, unpack } from "msgpackr";
import type { Block, Style, Placement, Font, Source, Overlay, RenderProfile } from "./types.js";

/**
 * Verseline binary format (.verseline)
 *
 * MessagePack-encoded, structurally identical to the unified JSON format.
 * Compact, fast to parse, supports all JS types (strings, numbers, arrays, objects).
 * No codegen needed — the schema is the TypeScript types themselves.
 *
 * File magic: first 4 bytes are "VRSL" (0x5652534C) for identification.
 * Byte 5 is the format version (currently 1).
 * Remaining bytes are the msgpack payload.
 */

const MAGIC = new Uint8Array([0x56, 0x52, 0x53, 0x4c]); // "VRSL"
const FORMAT_VERSION = 1;

export interface VerselineFile {
  version: number;
  name: string;
  canvas: { width: number; height: number; fps: number };
  assets: {
    audio?: string;
    background: { type?: string; path: string; loop?: boolean; fit?: string };
  };
  fonts: Font[];
  styles: Style[];
  placements: Placement[];
  sources: Source[];
  overlays: Overlay[];
  render_profiles: RenderProfile[];
  segments: VerselineFileSegment[];
}

export interface VerselineFileSegment {
  id?: string;
  start_ms: number;
  end_ms: number;
  status?: string;
  confidence?: number;
  notes?: string;
  blocks: Block[];
}

/** Encode a project to the .verseline binary format. */
export function encodeVerseline(data: VerselineFile): Uint8Array {
  const payload = pack(data);
  const result = new Uint8Array(MAGIC.length + 1 + payload.length);
  result.set(MAGIC, 0);
  result[MAGIC.length] = FORMAT_VERSION;
  result.set(payload, MAGIC.length + 1);
  return result;
}

/** Decode a .verseline binary file. Throws on invalid magic or version. */
export function decodeVerseline(bytes: Uint8Array): VerselineFile {
  if (bytes.length < 5) throw new Error("file too small to be a .verseline file");
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error("invalid .verseline file (bad magic)");
  }
  const version = bytes[MAGIC.length];
  if (version !== FORMAT_VERSION) {
    throw new Error(`unsupported .verseline version ${version} (expected ${FORMAT_VERSION})`);
  }
  const payload = bytes.slice(MAGIC.length + 1);
  return unpack(payload) as VerselineFile;
}

/** Check if a buffer starts with the .verseline magic bytes. */
export function isVerselineBinary(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) return false;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) return false;
  }
  return true;
}

export const VERSELINE_EXT = ".verseline";
export const VERSELINE_JSON_EXT = ".verseline.json";
