/**
 * Verseline MCP stdio server entry point.
 *
 * Communicates with AI assistants via stdin/stdout JSON-RPC (MCP protocol).
 * Calls the Verseline backend API over HTTP.
 *
 * Configuration (environment variables):
 *   VERSELINE_API_URL    — backend base URL (default: http://localhost:4000)
 *   VERSELINE_API_TOKEN  — Bearer token for API auth (single-tenant)
 *   OPENAI_API_KEY       — required for verseline_transcribe
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

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
import {
  listProjectsInputSchema,
  handleListProjects,
} from "./tools/list-projects.js";
import {
  createSegmentInputSchema,
  handleCreateSegment,
  deleteSegmentInputSchema,
  handleDeleteSegment,
} from "./tools/segment-crud.js";
import {
  approveTimelineInputSchema,
  handleApproveTimeline,
} from "./tools/approve-timeline.js";
import {
  previewSegmentInputSchema,
  handlePreviewSegment,
  renderProjectInputSchema,
  handleRenderProject,
  getRenderJobInputSchema,
  handleGetRenderJob,
} from "./tools/render.js";
import {
  libraryListInputSchema,
  handleLibraryList,
  libraryLinkInputSchema,
  handleLibraryLink,
} from "./tools/library.js";

const SCHEMA_DOC = `Project schema (R2 keys are opaque storage paths — use verseline_list_projects to discover IDs, library tools for assets):
{
  "id": "uuid", "name": "string",
  "canvas": { "width": int>0, "height": int>0, "fps": int>0 },
  "assets": { "audio": "r2-key (optional)", "background": { "path": "r2-key", "type": "image|video|color", "loop": bool, "fit": "cover|contain" } },
  "fonts": [{ "id": "string", "family": "string", "files": ["r2-key of .ttf/.otf"] }],
  "styles": [{ "id": "string", "font": "font-id", "size": int, "color": "#RRGGBB", "outline"/"outline_color", "shadow"/"shadow_color", "text_bg"/"text_bg_pad"/"text_bg_radius", "line_height", "align" }],
  "placements": [{ "id": "string", "anchor": "top-left|top-center|top-right|middle-left|center|middle-right|bottom-left|bottom-center|bottom-right", "margin_x", "margin_y", "max_width", "max_height" }],
  "sources": [{ "id": "string", "type": "json|jsonl", "path": "r2-key", "language", "text_field", "key_field" }],
  "overlays": [{ "id", "start": "HH:MM:SS.mmm", "end": "HH:MM:SS.mmm", "blocks": [...] }],
  "renderProfiles": [{ "id", "label", "width", "height", "fps", "crf", "preset", "video_codec", "audio_codec", "output_suffix" }]
}

Segment: {"id":"uuid","startMs":int,"endMs":int,"status":"draft|approved|needs_fix","notes":string|null,"confidence":float|null,"blocks":[{"text":"string","style":"style-id","placement":"placement-id","source":{"source":"src-id","refs":["..."]}}]}

Inline style tags: block.text may contain <styleID>...</styleID> segments rendered with that style's color. styleID must exist in project.styles. Tags do not nest.

Segments can overlap in time — multiple segments covering the same ms range render as stacked layers (later segments on top).`;

// ---- Server setup ----

const server = new McpServer({
  name: "verseline",
  version: "0.3.0",
});

// ---- Discovery ----

server.tool(
  "verseline_list_projects",
  `List all Verseline projects owned by the authenticated user. Use this first if you don't know the project_id. Returns id, name, canvas dimensions, and createdAt for each.`,
  listProjectsInputSchema,
  async (input) => handleListProjects(input),
);

// ---- Project inspection / validation ----

server.tool(
  "verseline_inspect_project",
  `Load a project and return canvas, assets (R2 keys), fonts, styles, placements, sources, render profiles, overlays count, and draft/approved segment counts. ${SCHEMA_DOC}`,
  inspectInputSchema,
  async (input) => handleInspectProject(input),
);

server.tool(
  "verseline_list_segments",
  `Return paginated segments from the draft or approved timeline. Each segment includes 1-based number, start/end timestamps, status, block count, text_preview (first 160 chars), source refs. Response includes has_more. Defaults: timeline="draft", start_at=1, limit=50 (max 200). Segments can overlap in time.`,
  listInputSchema,
  async (input) => handleListSegments(input),
);

server.tool(
  "verseline_validate_project",
  `Validate a project and one timeline. Checks: canvas > 0, assets.background.path set, block has text OR source reference, all style/placement/source references exist. Throws the first failing check, otherwise returns { valid: true, segment_count }.`,
  validateInputSchema,
  async (input) => handleValidateProject(input),
);

// ---- Segment editing ----

server.tool(
  "verseline_update_segment",
  `Update a single draft or approved segment in-place. Set any of: start/end (HH:MM:SS.mmm), status, notes, confidence, or a single block's text/style/placement (identify block by 1-based block_index, default 1). Alternatively pass blocks=[...] to REPLACE the entire blocks array (use this to add/remove/reorder blocks — include every block you want to keep). Identify target segment by segment_number (1-based) or segment_id. dry_run=true previews without saving. Block text supports <styleID>...</styleID> inline tags; styleID must already exist in project.styles.`,
  updateSegmentInputSchema,
  async (input) => handleUpdateSegment(input),
);

server.tool(
  "verseline_create_segment",
  `Create a new draft or approved segment. Required: project_id, start, end. Optional: status, notes, blocks, sort_order (defaults to appended). Returns the created segment summary.`,
  createSegmentInputSchema,
  async (input) => handleCreateSegment(input),
);

server.tool(
  "verseline_delete_segment",
  `Delete one segment (identified by segment_number or segment_id). Subsequent segments' sort orders are shifted down by 1.`,
  deleteSegmentInputSchema,
  async (input) => handleDeleteSegment(input),
);

server.tool(
  "verseline_split_segment",
  `Split one segment into N>=2 segments by splitting a block's text. Provide texts array (min 2). Duration is divided equally (floor) across fragments; the last fragment absorbs the remainder. Identify by segment_number or segment_id; the block by 1-based block_index (default 1). dry_run=true previews.`,
  splitSegmentInputSchema,
  async (input) => handleSplitSegment(input),
);

server.tool(
  "verseline_approve_timeline",
  `Copy the draft timeline over the approved timeline (replaces all approved segments with clones of drafts). Returns the approved segment count. Required: project_id.`,
  approveTimelineInputSchema,
  async (input) => handleApproveTimeline(input),
);

// ---- Project updates ----

server.tool(
  "verseline_update_project",
  `Upsert or remove project configuration items. Pass exactly one action object: { target: "style"|"placement"|"font"|"source"|"render_profile", action: "upsert"|"remove", value: {...} | id: "string" }. For upsert, value must include an id. To rename a project, set name. To change canvas, set canvas={width,height,fps}.`,
  updateProjectInputSchema,
  async (input) => handleUpdateProject(input),
);

// ---- Rendering ----

server.tool(
  "verseline_preview_segment",
  `Render a low-quality single-segment preview from the DRAFT timeline, upload to R2, return a 1-hour presigned URL. Use segment_number (1-based, default 1).`,
  previewSegmentInputSchema,
  async (input) => handlePreviewSegment(input),
);

server.tool(
  "verseline_render_project",
  `Start an async full-project render from the APPROVED timeline. Returns jobId immediately. Poll with verseline_get_render_job. Optional profile_id (default "default").`,
  renderProjectInputSchema,
  async (input) => handleRenderProject(input),
);

server.tool(
  "verseline_get_render_job",
  `Get render job status. Returns { status: "pending"|"running"|"done"|"failed", progress (0-100), downloadUrl (1-hour presigned, when done), error }.`,
  getRenderJobInputSchema,
  async (input) => handleGetRenderJob(input),
);

// ---- Transcription ----

server.tool(
  "verseline_transcribe",
  `Transcribe an audio file with OpenAI Whisper. Input is a LOCAL absolute or relative path (not an R2 key — download the audio first if needed). Writes JSONL batches to output_dir (created if needed). Each batch line: {"start":"HH:MM:SS.mmm","end":"HH:MM:SS.mmm","text":"...","confidence":0-1}. Returns batch file paths only. To seed draft segments from a transcript, use verseline_create_segment per line in a follow-up call. Requires OPENAI_API_KEY.`,
  transcribeInputSchema,
  async (input) => handleTranscribe(input),
);

// ---- Readability ----

server.tool(
  "verseline_check_readability",
  `Analyze per-block contrast aids for a segment. Returns, for each block: text_color, estimated contrast_ratio against neutral gray (rough — the real background image is not sampled here), meets_wcag_aa (>=3.0), meets_wcag_aaa (>=4.5), has_outline/has_shadow/has_text_bg, and recommendations (empty if any contrast aid is present). Use verseline_update_project to apply recommended style changes.`,
  readabilityInputSchema,
  async (input) => handleCheckReadability(input),
);

// ---- Library ----

server.tool(
  "verseline_library_list",
  `List the user's library assets (audio/background/font/image/video). Supports filtering by type and fuzzy name query. Paginated. Returns { id, name, assetType, r2Key, contentType, metadata, createdAt } per asset plus total count.`,
  libraryListInputSchema,
  async (input) => handleLibraryList(input),
);

server.tool(
  "verseline_library_link",
  `Link or unlink a library asset to/from a project. action="link" adds it, action="unlink" removes it. The asset remains in the library either way.`,
  libraryLinkInputSchema,
  async (input) => handleLibraryLink(input),
);

// ---- Start ----

const transport = new StdioServerTransport();
await server.connect(transport);
