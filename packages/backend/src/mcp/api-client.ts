/**
 * Internal HTTP client for the MCP server to call the Verseline backend API.
 */

const API_URL = (process.env.VERSELINE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const API_TOKEN = process.env.VERSELINE_API_TOKEN ?? "";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function mcpFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (API_TOKEN) {
    headers["Authorization"] = `Bearer ${API_TOKEN}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// ---- Project types (mirroring DB schema) ----

export interface ApiCanvas {
  width: number;
  height: number;
  fps: number;
}

export interface ApiBackground {
  path: string;
  type?: string;
  loop?: boolean;
  fit?: string;
}

export interface ApiAssets {
  audio?: string;
  background: ApiBackground;
}

export interface ApiStyle {
  id: string;
  font: string;
  size: number;
  color?: string;
  outline_color?: string;
  outline?: number;
  shadow_color?: string;
  shadow?: number;
  text_bg?: string;
  text_bg_pad?: number;
  text_bg_radius?: number;
  align?: string;
  line_height?: number;
}

export interface ApiPlacement {
  id: string;
  anchor: string;
  margin_x?: number;
  margin_y?: number;
  max_width?: number;
  max_height?: number;
}

export interface ApiFont {
  id: string;
  family: string;
  files?: string[];
}

export interface ApiSource {
  id: string;
  type: string;
  path: string;
  language?: string;
  text_field?: string;
  key_field?: string;
}

export interface ApiRenderProfile {
  id: string;
  label?: string;
  width?: number;
  height?: number;
  fps?: number;
  output?: string;
  output_suffix?: string;
  video_codec?: string;
  audio_codec?: string;
  crf?: number;
  preset?: string;
}

export interface ApiProject {
  id: string;
  userId: string;
  name: string;
  canvas: ApiCanvas;
  assets: ApiAssets;
  fonts: ApiFont[];
  styles: ApiStyle[];
  placements: ApiPlacement[];
  sources: ApiSource[];
  overlays: object[];
  renderProfiles: ApiRenderProfile[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiBlock {
  id?: string;
  kind?: string;
  text?: string;
  style?: string;
  placement?: string;
  language?: string;
  source?: {
    source: string;
    mode?: string;
    refs?: string[];
  };
}

export interface ApiSegment {
  id: string;
  projectId: string;
  timelineKind: string;
  sortOrder: number;
  startMs: number;
  endMs: number;
  status: string;
  confidence: number | null;
  notes: string | null;
  blocks: ApiBlock[];
  createdAt: string;
  updatedAt: string;
}

// ---- Project API ----

export async function getProjects(): Promise<ApiProject[]> {
  const data = await mcpFetch<{ projects: ApiProject[] }>("/projects");
  return data.projects;
}

export async function getProject(id: string): Promise<ApiProject> {
  const data = await mcpFetch<{ project: ApiProject }>(`/projects/${id}`);
  return data.project;
}

export async function updateProject(
  id: string,
  body: Partial<Omit<ApiProject, "id" | "userId" | "createdAt" | "updatedAt">>,
): Promise<ApiProject> {
  const data = await mcpFetch<{ project: ApiProject }>(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return data.project;
}

// ---- Segment API ----

export async function getSegments(
  projectId: string,
  kind: string = "draft",
): Promise<ApiSegment[]> {
  const data = await mcpFetch<{ segments: ApiSegment[] }>(
    `/projects/${projectId}/segments?kind=${encodeURIComponent(kind)}`,
  );
  return data.segments;
}

export async function createSegment(
  projectId: string,
  body: Partial<ApiSegment>,
): Promise<ApiSegment> {
  const data = await mcpFetch<{ segment: ApiSegment }>(
    `/projects/${projectId}/segments`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.segment;
}

export async function updateSegment(
  projectId: string,
  segId: string,
  body: Partial<Pick<ApiSegment, "startMs" | "endMs" | "status" | "notes" | "blocks" | "confidence">>,
): Promise<ApiSegment> {
  const data = await mcpFetch<{ segment: ApiSegment }>(
    `/projects/${projectId}/segments/${segId}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
  return data.segment;
}

export async function splitSegment(
  projectId: string,
  segId: string,
  body: { blockIndex: number; texts: string[] },
): Promise<ApiSegment[]> {
  const data = await mcpFetch<{ segments: ApiSegment[] }>(
    `/projects/${projectId}/segments/${segId}/split`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.segments;
}

export async function deleteSegment(
  projectId: string,
  segId: string,
): Promise<void> {
  await mcpFetch<{ success: boolean }>(
    `/projects/${projectId}/segments/${segId}`,
    { method: "DELETE" },
  );
}

export async function approveTimeline(projectId: string): Promise<ApiSegment[]> {
  const data = await mcpFetch<{ segments: ApiSegment[] }>(
    `/projects/${projectId}/segments/approve`,
    { method: "POST" },
  );
  return data.segments;
}

// ---- Render API ----

export interface ApiRenderJob {
  id: string;
  projectId: string;
  status: string;
  profileId: string | null;
  progress: number | null;
  outputKey: string | null;
  downloadUrl?: string;
  error: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function previewSegment(
  projectId: string,
  segIndex: number,
): Promise<{ url: string; key: string }> {
  return mcpFetch<{ url: string; key: string }>(
    `/projects/${projectId}/preview/${segIndex}`,
    { method: "POST" },
  );
}

export async function renderProject(
  projectId: string,
  profileId: string,
): Promise<{ jobId: string; status: string }> {
  return mcpFetch<{ jobId: string; status: string }>(
    `/projects/${projectId}/render`,
    { method: "POST", body: JSON.stringify({ profileId }) },
  );
}

export async function getRenderJob(jobId: string): Promise<ApiRenderJob> {
  const data = await mcpFetch<{ job: ApiRenderJob }>(`/render/jobs/${jobId}`);
  return data.job;
}

// ---- Library API ----

export interface ApiLibraryAsset {
  id: string;
  userId: string;
  name: string;
  assetType: string;
  r2Key: string | null;
  filename: string;
  contentType: string | null;
  metadata: unknown;
  pexelsId: string | null;
  pexelsUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function listLibraryAssets(params: {
  type?: string;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<{ assets: ApiLibraryAsset[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.q) qs.set("q", params.q);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return mcpFetch<{ assets: ApiLibraryAsset[]; total: number }>(
    `/library${query ? `?${query}` : ""}`,
  );
}

export async function linkLibraryAsset(
  assetId: string,
  projectId: string,
): Promise<{ linked: boolean }> {
  return mcpFetch<{ linked: boolean }>(
    `/library/${assetId}/link/${projectId}`,
    { method: "POST" },
  );
}

export async function unlinkLibraryAsset(
  assetId: string,
  projectId: string,
): Promise<void> {
  await mcpFetch<unknown>(
    `/library/${assetId}/link/${projectId}`,
    { method: "DELETE" },
  );
}
