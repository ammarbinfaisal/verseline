/**
 * Verseline MCP stdio server entry point.
 *
 * Communicates with AI assistants via stdin/stdout JSON-RPC (MCP protocol).
 * Calls the Verseline backend API over HTTP.
 *
 * Configuration (environment variables):
 *   VERSELINE_API_URL    — backend base URL (default: http://localhost:4000)
 *   VERSELINE_API_TOKEN  — Bearer token for API auth
 *   OPENAI_API_KEY       — required for verseline_transcribe
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { inspectInputSchema, handleInspectProject } from "./tools/inspect.js";
import { listInputSchema, handleListSegments } from "./tools/list.js";
import { validateInputSchema, handleValidateProject } from "./tools/validate.js";
import {
  updateSegmentInputSchema,
  handleUpdateSegment,
} from "./tools/update-segment.js";
import {
  splitSegmentInputSchema,
  handleSplitSegment,
} from "./tools/split-segment.js";
import {
  updateProjectInputSchema,
  handleUpdateProject,
} from "./tools/update-project.js";
import { transcribeInputSchema, handleTranscribe } from "./tools/transcribe.js";
import {
  readabilityInputSchema,
  handleCheckReadability,
} from "./tools/readability.js";

// ---- Server setup ----

const server = new McpServer({
  name: "verseline",
  version: "0.2.0",
});

// ---- Tool: verseline_inspect_project ----

server.tool(
  "verseline_inspect_project",
  `Load a Verseline project and return its canvas dimensions, asset paths, registered styles, placements, sources, render profiles, and timeline info with segment counts.

The project schema:
{
  "name": "string (optional)",
  "output": "string — output file path (optional)",
  "canvas": { "width": int, "height": int, "fps": int },
  "assets": {
    "audio": "string — path to audio file (optional)",
    "background": { "path": "string (required)", "type": "\"image\" or \"video\" (optional, default image)", "loop": bool (optional), "fit": "\"cover\" or \"contain\" (optional, default cover)" }
  },
  "fonts": [{ "id": "string", "family": "string", "files": ["path to .ttf/.otf file"] }],
  "styles": [{
    "id": "string", "font": "string — references a font id", "size": int,
    "color": "#RRGGBB (optional)",
    "outline_color": "#RRGGBB (optional)", "outline": int pixels (optional),
    "shadow_color": "#RRGGBB or #RRGGBBAA (optional)", "shadow": int pixels (optional),
    "text_bg": "#RRGGBB or #RRGGBBAA (optional) — background color for a rounded box behind the text",
    "text_bg_pad": int pixels (optional) — padding inside the text background box",
    "text_bg_radius": int pixels (optional) — corner radius of the text background box",
    "line_height": int (optional)
  }],
  "placements": [{ "id": "string", "anchor": "top-left|top-center|top-right|middle-left|center|middle-right|bottom-left|bottom-center|bottom-right", "margin_x": int (optional), "margin_y": int (optional), "max_width": int (optional), "max_height": int (optional) }],
  "sources": [{ "id": "string", "type": "json|jsonl", "path": "string", "language": "string (optional)", "text_field": "string (optional)", "key_field": "string (optional)" }],
  "overlays": [{ "id": "string (optional)", "start": "HH:MM:SS.mmm (optional — default 0)", "end": "HH:MM:SS.mmm (optional — default end of video)", "blocks": [block...] }],
  "render_profiles": [{ "id": "string", "label": "string (optional)", "width": int (optional)", "height": int (optional)", "fps": int (optional)", "output": "string (optional)", "output_suffix": "string (optional)", "video_codec": "string (optional)", "audio_codec": "string (optional)", "crf": int (optional)", "preset": "string (optional)" }]
}

A timeline has one segment per entry:
{"id":"string","startMs":int,"endMs":int,"status":"draft|approved|needs_fix","blocks":[{"text":"string","style":"style-id","placement":"placement-id"},...]}

Inline style tags: block text can contain <styleID>...</styleID> tags to render portions in a different style's color. Example: "Glorified <aux>(and Exalted)</aux> be He" renders "(and Exalted)" using the "aux" style's color. The tag name must match a style ID in the project. Tags do not nest.

Multiple text cards can overlap in time — all render simultaneously when their time ranges overlap.`,
  inspectInputSchema,
  async (input) => {
    return handleInspectProject(input);
  },
);

// ---- Tool: verseline_list_segments ----

server.tool(
  "verseline_list_segments",
  `Return paginated segments from a project's draft or approved timeline. Each segment includes its 1-based number, start/end timestamps, status, block count, a text preview (first 160 characters), and source references. Defaults: timeline="draft", start_at=1, limit=50.

Segments can overlap in time — multiple segments may cover the same time range and all render simultaneously as stacked layers. This is by design: use overlapping segments for parallel text cards (e.g., verse text from 0s-20s and a continuous attribution from 0s-60s spanning multiple verses).`,
  listInputSchema,
  async (input) => {
    return handleListSegments(input);
  },
);

// ---- Tool: verseline_validate_project ----

server.tool(
  "verseline_validate_project",
  `Validate a project and one of its timelines. Checks: canvas dimensions are positive, background path is set, all IDs are unique and non-empty, every block has text or a source, and all style/placement/source references in the timeline exist in the project. Returns valid=true or an error describing the first failing check.`,
  validateInputSchema,
  async (input) => {
    return handleValidateProject(input);
  },
);

// ---- Tool: verseline_update_segment ----

server.tool(
  "verseline_update_segment",
  `Update properties of a single segment in the draft or approved timeline. Can set start, end, status, notes, or a single block's text/style/placement. Identify the segment by 1-based segment_number or segment_id. Set dry_run=true to preview the change without saving. Block text may contain inline style tags: <styleID>text</styleID> to render portions with a different style's color (the styleID must exist in the project's styles array — use verseline_update_project to add it first).

Segments can overlap in time — you can set a segment's start/end to any range, even if it overlaps other segments. Overlapping segments render as stacked layers (later segments on top). This enables parallel text cards like a verse spanning 0s-10s with an attribution spanning 0s-60s.`,
  updateSegmentInputSchema,
  async (input) => {
    return handleUpdateSegment(input);
  },
);

// ---- Tool: verseline_split_segment ----

server.tool(
  "verseline_split_segment",
  `Replace one timeline segment with multiple shorter segments by splitting a block's text. Provide the new text fragments in the texts array (minimum 2). Time is split equally across fragments. Identify the segment by segment_number or segment_id, and the block by block_index (1-based, default 1). Set dry_run=true to preview.

Note: segments can overlap in time. If you need a block (e.g., an attribution) to span the full duration of a verse that was split into multiple segments, create a separate overlapping segment covering the full verse time range rather than duplicating the block in each split segment.`,
  splitSegmentInputSchema,
  async (input) => {
    return handleSplitSegment(input);
  },
);

// ---- Tool: verseline_update_project ----

server.tool(
  "verseline_update_project",
  `Add, update, or remove a style or placement in the project. Exactly one action per call: set upsert_style to add or replace a style by ID, remove_style to delete by ID, upsert_placement to add or replace a placement by ID, or remove_placement to delete by ID. The project is saved after the change. Use this to define new styles for inline <styleID>...</styleID> tags in block text.`,
  updateProjectInputSchema,
  async (input) => {
    return handleUpdateProject(input);
  },
);

// ---- Tool: verseline_transcribe ----

server.tool(
  "verseline_transcribe",
  `Transcribe an audio file using the OpenAI Whisper API and write results as JSONL batch files to output_dir. Each batch file contains up to lines_per_batch entries (1–100, default 50). Each JSONL line is {"start":"HH:MM:SS.mmm","end":"HH:MM:SS.mmm","text":"...","confidence":0.0-1.0}. Returns the list of written file paths and line counts — does not return transcription content in the tool result. Requires OPENAI_API_KEY in the environment.`,
  transcribeInputSchema,
  async (input) => {
    return handleTranscribe(input);
  },
);

// ---- Tool: verseline_check_readability ----

server.tool(
  "verseline_check_readability",
  `Analyze text-on-background contrast for a specific segment. Returns per-block: text color, estimated contrast ratio, whether WCAG AA (>=3:1) and AAA (>=4.5:1) thresholds are met, whether outline/shadow/text_bg are set, and recommendations to improve contrast. Note: this TypeScript server estimates contrast against a neutral background; for pixel-accurate background sampling use the verseline Go binary. Use verseline_update_project to apply recommended style changes.`,
  readabilityInputSchema,
  async (input) => {
    return handleCheckReadability(input);
  },
);

// ---- Start ----

const transport = new StdioServerTransport();
await server.connect(transport);
