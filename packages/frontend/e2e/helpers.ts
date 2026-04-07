import type { Page } from "@playwright/test";

export const API_URL = "http://localhost:4001";

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

/**
 * Log in via the UI so that the token is obtained in the browser context
 * with the exact same backend the frontend talks to.
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/projects", { timeout: 10_000 });
}

/**
 * Inject a JWT token into localStorage so the page is authenticated.
 * Navigates to /login first to get a browsing context, sets localStorage,
 * then subsequent goto() calls will pick it up.
 */
export async function injectAuth(page: Page, token: string) {
  await page.addInitScript((t) => {
    localStorage.setItem("verseline_token", t);
  }, token);
  await page.goto("/login");
  await page.evaluate((t) => {
    localStorage.setItem("verseline_token", t);
  }, token);
}

/** Create a project via the API and return its id. */
export async function apiCreateProject(
  token: string,
  name = "Test Project",
  overrides: Record<string, unknown> = {},
) {
  const res = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, ...overrides }),
  });
  if (!res.ok) throw new Error(`create project failed: ${res.status}`);
  const data = (await res.json()) as { project: { id: string; name: string; [k: string]: unknown } };
  return data.project;
}

/** Update a project via the API. */
export async function apiUpdateProject(
  token: string,
  projectId: string,
  data: Record<string, unknown>,
) {
  const res = await fetch(`${API_URL}/projects/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update project failed: ${res.status}`);
  return (await res.json()) as { project: Record<string, unknown> };
}

/** Get a project via the API. */
export async function apiGetProject(token: string, projectId: string) {
  const res = await fetch(`${API_URL}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`get project failed: ${res.status}`);
  return (await res.json()) as { project: Record<string, unknown> };
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
  const data = (await res.json()) as { segment: { id: string; [k: string]: unknown } };
  return data.segment;
}

/** List segments via the API. */
export async function apiListSegments(token: string, projectId: string) {
  const res = await fetch(`${API_URL}/projects/${projectId}/segments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`list segments failed: ${res.status}`);
  return (await res.json()) as { segments: Array<{ id: string; [k: string]: unknown }> };
}

/** Update a segment via the API. */
export async function apiUpdateSegment(
  token: string,
  projectId: string,
  segId: string,
  data: Record<string, unknown>,
) {
  const res = await fetch(`${API_URL}/projects/${projectId}/segments/${segId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update segment failed: ${res.status}`);
  return (await res.json()) as { segment: { id: string; [k: string]: unknown } };
}

/** Delete a segment via the API. */
export async function apiDeleteSegment(token: string, projectId: string, segId: string) {
  const res = await fetch(`${API_URL}/projects/${projectId}/segments/${segId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`delete segment failed: ${res.status}`);
}

/** Delete a project via the API (cleanup). */
export async function apiDeleteProject(token: string, projectId: string) {
  await fetch(`${API_URL}/projects/${projectId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Pick N random items from an array (Fisher-Yates partial shuffle). */
export function randomSample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    result.push(copy[i]);
  }
  return result;
}
