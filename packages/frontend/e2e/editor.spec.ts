import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiSignup,
  injectAuth,
  apiCreateProject,
  apiCreateSegment,
  apiDeleteProject,
} from "./helpers";

test.describe("Editor", () => {
  let token: string;
  let projectId: string;

  test.beforeAll(async () => {
    const email = uniqueEmail();
    const result = await apiSignup(email, "testpass123");
    token = result.token;
    const project = await apiCreateProject(token, "Editor E2E");
    projectId = project.id;
  });

  test.afterAll(async () => {
    await apiDeleteProject(token, projectId).catch(() => {});
  });

  test("editor loads and shows tab bar", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto(`/projects/${projectId}`);

    await expect(page.getByRole("button", { name: "Timeline" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Styles" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Placements" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fonts" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  });

  test("empty timeline shows no segments message", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText(/no segments/i)).toBeVisible({ timeout: 10_000 });
  });

  test("add new segment via button", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /new segment/i }).click();

    // New segment shows time range like "00:00.000 – 00:03.000" (formatRange strips leading 00:)
    await expect(page.getByText(/00:00\.000/)).toBeVisible({ timeout: 10_000 });
  });

  test("switch tabs works", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState("networkidle");

    // Click Styles tab
    await page.getByRole("button", { name: "Styles" }).click();
    await expect(page.getByRole("button", { name: /new/i })).toBeVisible({ timeout: 5000 });

    // Click Placements tab
    await page.getByRole("button", { name: "Placements" }).click();
    await expect(page.getByRole("button", { name: /new/i })).toBeVisible({ timeout: 5000 });

    // Click Settings tab
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByText(/project settings/i)).toBeVisible({ timeout: 5000 });

    // Back to Timeline
    await page.getByRole("button", { name: "Timeline" }).click();
    await expect(page.getByRole("button", { name: /new segment/i })).toBeVisible({ timeout: 5000 });
  });

  test("segment with blocks renders in timeline", async ({ page }) => {
    // Create a project with a segment via API
    const proj = await apiCreateProject(token, "Segments E2E");
    await apiCreateSegment(token, proj.id, 5000, 15000, [
      { text: "Hello world", style: "main", placement: "center" },
    ]);

    await injectAuth(page, token);
    await page.goto(`/projects/${proj.id}`);

    // Segment should appear in the timeline list (first match in the sidebar)
    await expect(page.getByText("Hello world").first()).toBeVisible({ timeout: 10_000 });

    // Cleanup
    await apiDeleteProject(token, proj.id);
  });

  test("settings tab shows canvas dimensions", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("button", { name: "Settings" }).click();

    // Canvas width/height inputs should be present
    const widthInput = page.locator("input[type='number']").first();
    await expect(widthInput).toBeVisible({ timeout: 5000 });
  });
});
