import type { Page } from "@playwright/test";

const API_URL = "http://localhost:4001";

let testCounter = 0;

/** Generate a unique test email so tests don't collide. */
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${++testCounter}@test.local`;
}

/** Sign up a new user via the API and return their token. */
export async function apiSignup(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { token: string; user: { id: string; email: string } };
}

/** Inject a JWT token into localStorage so the page is authenticated. */
export async function injectAuth(page: Page, token: string) {
  await page.addInitScript((t) => {
    localStorage.setItem("verseline_token", t);
  }, token);
}

/** Create a project via the API and return its id. */
export async function apiCreateProject(token: string, name = "Test Project") {
  const res = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`create project failed: ${res.status}`);
  const data = (await res.json()) as { project: { id: string; name: string } };
  return data.project;
}

/** Create a segment via the API. */
export async function apiCreateSegment(
  token: string,
  projectId: string,
  startMs: number,
  endMs: number,
  blocks: object[] = [{ text: "Test block", style: "main", placement: "center" }],
) {
  const res = await fetch(`${API_URL}/projects/${projectId}/segments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ startMs, endMs, blocks }),
  });
  if (!res.ok) throw new Error(`create segment failed: ${res.status}`);
  const data = (await res.json()) as { segment: { id: string } };
  return data.segment;
}

/** Delete a project via the API (cleanup). */
export async function apiDeleteProject(token: string, projectId: string) {
  await fetch(`${API_URL}/projects/${projectId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
