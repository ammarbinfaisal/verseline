/**
 * Server-backed preset library — round-trip, cross-user isolation, built-in
 * protection. See /design.md §V2.1 / §V2.2 / §V2.3.
 */
import { test, expect } from "@playwright/test";
import { apiSignup, injectAuth, uniqueEmail, API_URL } from "./helpers";

async function authedFetch(token: string, path: string, init: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
  });
}

test.describe("preset server round-trip", () => {
  test("style saved to library survives a reload and is in the picker", async ({ page }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");
    await injectAuth(page, token);

    // Create a project so the editor + style tab are reachable.
    const proj = await authedFetch(token, "/projects", {
      method: "POST",
      body: JSON.stringify({
        name: "preset round-trip",
        canvas: { width: 1920, height: 1080, fps: 30 },
        assets: { background: { path: "" } },
        timeline: {},
        styles: [
          { id: "round-trip-style", font: "geist-sans", size: 32, color: "#FF00AA", align: "center" },
        ],
      }),
    }).then((r) => r.json());
    const projectId = proj.project.id;

    await page.goto(`/projects/${projectId}`);
    await page.getByTestId("editor-root").waitFor();
    await page.getByRole("tab", { name: "Styles" }).click();
    await page.getByTestId("style-row-round-trip-style").click();

    // Save to library.
    await page.getByTestId("style-save-library").click();
    await expect(page.locator("text=saved to library")).toBeVisible({ timeout: 5000 });

    // The server now has the preset. Verify via API.
    const list1 = await authedFetch(token, "/presets?kind=style").then((r) => r.json());
    const found = list1.presets.find(
      (p: { kind: string; payload: { id: string } }) =>
        p.kind === "style" && p.payload.id === "round-trip-style",
    );
    expect(found).toBeDefined();

    // Reload the page; open the picker — preset is listed under "Your library".
    await page.reload();
    await page.getByTestId("editor-root").waitFor();
    await page.getByRole("tab", { name: "Styles" }).click();
    await page.getByTestId("open-style-picker").click();
    await expect(page.getByTestId("preset-list-style")).toContainText("round-trip-style");
  });
});

test.describe("preset cross-user isolation", () => {
  test("user A's saved presets are not visible to user B", async ({ page }) => {
    const a = await apiSignup(uniqueEmail(), "password1234");
    const b = await apiSignup(uniqueEmail(), "password1234");

    // User A creates a preset directly via the API.
    const upsert = await authedFetch(a.token, "/presets", {
      method: "POST",
      body: JSON.stringify({
        kind: "placement",
        payload: {
          id: "isolation-a-only",
          name: "A only",
          anchor: "center",
          x: 0.4,
          y: 0.4,
        },
      }),
    });
    expect(upsert.ok).toBe(true);

    // User B's list does NOT include A's preset.
    const bList = await authedFetch(b.token, "/presets").then((r) => r.json());
    const leak = (bList.presets as Array<{ payload: { id: string } }>).find(
      (p) => p.payload.id === "isolation-a-only",
    );
    expect(leak).toBeUndefined();

    // Sanity: A still sees their own preset.
    const aList = await authedFetch(a.token, "/presets").then((r) => r.json());
    expect(
      (aList.presets as Array<{ payload: { id: string } }>).some(
        (p) => p.payload.id === "isolation-a-only",
      ),
    ).toBe(true);

    // Use page just to satisfy the test signature requirement.
    void page;
  });
});

test.describe("built-in preset protection", () => {
  test("DELETE on a built-in preset returns 403", async ({ page }) => {
    const { token } = await apiSignup(uniqueEmail(), "password1234");
    void page;

    // Get the built-in catalogue. If the server has no built-ins seeded,
    // skip — V2.3 seed is a separate manual step in v1 of this loop.
    const builtIn = await authedFetch(token, "/presets/builtin").then((r) => r.json());
    if (!builtIn.presets || builtIn.presets.length === 0) {
      test.skip(true, "no built-in presets seeded; run `bun run db:seed-presets`");
      return;
    }
    const target = builtIn.presets[0];
    const res = await authedFetch(token, `/presets/${target.id}`, { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});
