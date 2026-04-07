import type { Project, Segment, SegmentUpdates, SplitRequest } from "@verseline/shared";
import { tsToMillis, millisToTs } from "@verseline/shared";
import { getToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// --- Core fetch wrapper ---

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// --- Auth ---

interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

const auth = {
  signup(email: string, password: string): Promise<AuthResponse> {
    return apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async me(): Promise<{ id: string; email: string }> {
    const res = await apiFetch<{ user: { id: string; email: string } }>("/auth/me");
    return res.user;
  },

  forgotPassword(email: string): Promise<{ message: string }> {
    return apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },
};

// --- Projects ---

export interface ProjectRecord {
  id: string;
  name: string;
  canvas: { width: number; height: number; fps: number };
  assets: Record<string, unknown>;
  fonts: Record<string, unknown>[];
  styles: Record<string, unknown>[];
  placements: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  overlays: Record<string, unknown>[];
  renderProfiles: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
}

const projects = {
  async list(): Promise<ProjectRecord[]> {
    const res = await apiFetch<{ projects: ProjectRecord[] }>("/projects");
    return res.projects;
  },

  async get(id: string): Promise<ProjectRecord> {
    const res = await apiFetch<{ project: ProjectRecord }>(`/projects/${id}`);
    return res.project;
  },

  async create(data: Partial<Project>): Promise<ProjectRecord> {
    const res = await apiFetch<{ project: ProjectRecord }>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.project;
  },

  async update(id: string, data: Partial<Project>): Promise<ProjectRecord> {
    const res = await apiFetch<{ project: ProjectRecord }>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res.project;
  },

  delete(id: string): Promise<void> {
    return apiFetch(`/projects/${id}`, { method: "DELETE" });
  },
};

// --- Segments ---

// The backend stores startMs/endMs as numbers, but the frontend Segment type
// uses start/end as timestamp strings. These helpers convert between the two.

interface DbSegment {
  id?: string;
  startMs: number;
  endMs: number;
  status?: string;
  confidence?: number | null;
  notes?: string | null;
  blocks: unknown[];
  [key: string]: unknown;
}

function dbSegmentToFrontend(row: DbSegment): Segment {
  return {
    id: row.id,
    start: millisToTs(row.startMs),
    end: millisToTs(row.endMs),
    status: row.status,
    confidence: row.confidence ?? undefined,
    notes: row.notes ?? undefined,
    blocks: row.blocks as Segment["blocks"],
  };
}

const segments = {
  async list(projectId: string, kind?: "draft" | "approved"): Promise<Segment[]> {
    const qs = kind ? `?kind=${kind}` : "";
    const res = await apiFetch<{ segments: DbSegment[] }>(`/projects/${projectId}/segments${qs}`);
    return res.segments.map(dbSegmentToFrontend);
  },

  async create(projectId: string, data: Partial<Segment>): Promise<Segment> {
    // Convert frontend start/end strings to backend startMs/endMs numbers
    const body: Record<string, unknown> = { ...data };
    if (typeof data.start === "string") {
      body.startMs = tsToMillis(data.start);
      delete body.start;
    }
    if (typeof data.end === "string") {
      body.endMs = tsToMillis(data.end);
      delete body.end;
    }

    const res = await apiFetch<{ segment: DbSegment }>(`/projects/${projectId}/segments`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return dbSegmentToFrontend(res.segment);
  },

  async update(projectId: string, segId: string, data: SegmentUpdates): Promise<Segment> {
    // Convert frontend start/end strings to backend startMs/endMs numbers
    const body: Record<string, unknown> = { ...data };
    if (typeof data.start === "string") {
      body.startMs = tsToMillis(data.start);
      delete body.start;
    }
    if (typeof data.end === "string") {
      body.endMs = tsToMillis(data.end);
      delete body.end;
    }

    const res = await apiFetch<{ segment: DbSegment }>(`/projects/${projectId}/segments/${segId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return dbSegmentToFrontend(res.segment);
  },

  async split(projectId: string, segId: string, data: SplitRequest): Promise<Segment[]> {
    const res = await apiFetch<{ segments: DbSegment[] }>(`/projects/${projectId}/segments/${segId}/split`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.segments.map(dbSegmentToFrontend);
  },

  delete(projectId: string, segId: string): Promise<void> {
    return apiFetch(`/projects/${projectId}/segments/${segId}`, {
      method: "DELETE",
    });
  },

  approve(projectId: string): Promise<void> {
    return apiFetch(`/projects/${projectId}/segments/approve`, {
      method: "POST",
    });
  },
};

// --- Import/Export ---

const importExport = {
  async importFile(file: File): Promise<ProjectRecord> {
    const token = getToken();
    const form = new FormData();
    form.set("file", file);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/projects/import`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `Import failed (${res.status})`);
    }
    return res.json();
  },

  exportUrl(projectId: string): string {
    return `${BASE_URL}/projects/${projectId}/export`;
  },
};

// --- Exported API object ---

export const api = { auth, projects, segments, importExport };
export { apiFetch };
