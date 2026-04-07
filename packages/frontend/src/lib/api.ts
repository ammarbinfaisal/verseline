import type { Project, Segment, SegmentUpdates, SplitRequest } from "@verseline/shared";
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

  me(): Promise<{ id: string; email: string }> {
    return apiFetch("/auth/me");
  },
};

// --- Projects ---

interface ProjectRecord {
  id: string;
  data: Project;
  created_at: string;
  updated_at: string;
}

const projects = {
  list(): Promise<ProjectRecord[]> {
    return apiFetch("/projects");
  },

  get(id: string): Promise<ProjectRecord> {
    return apiFetch(`/projects/${id}`);
  },

  create(data: Partial<Project>): Promise<ProjectRecord> {
    return apiFetch("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<Project>): Promise<ProjectRecord> {
    return apiFetch(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<void> {
    return apiFetch(`/projects/${id}`, { method: "DELETE" });
  },
};

// --- Segments ---

const segments = {
  list(projectId: string, kind?: "draft" | "approved"): Promise<Segment[]> {
    const qs = kind ? `?kind=${kind}` : "";
    return apiFetch(`/projects/${projectId}/segments${qs}`);
  },

  create(projectId: string, data: Partial<Segment>): Promise<Segment> {
    return apiFetch(`/projects/${projectId}/segments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(projectId: string, segId: string, data: SegmentUpdates): Promise<Segment> {
    return apiFetch(`/projects/${projectId}/segments/${segId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  split(projectId: string, segId: string, data: SplitRequest): Promise<Segment[]> {
    return apiFetch(`/projects/${projectId}/segments/${segId}/split`, {
      method: "POST",
      body: JSON.stringify(data),
    });
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

// --- Exported API object ---

export const api = { auth, projects, segments };
export { apiFetch };
