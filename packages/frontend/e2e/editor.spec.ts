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

    await expect(page.getByRole("tab", { name: "Styles" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("tab", { name: "Placements" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Fonts" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Settings" })).toBeVisible();
  });

  test("empty timeline shows no segments message", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText("No segments yet")).toBeVisible({ timeout: 10_000 });
  });

  test("add new segment via button", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "+ New" }).click();

    // New segment shows time range like "00:00.000 – 00:03.000" (formatRange strips leading 00:)
    await expect(page.getByText(/00:00\.000/)).toBeVisible({ timeout: 10_000 });
  });

  test("switch tabs works", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState("networkidle");

    // Click Styles tab
    await page.getByRole("tab", { name: "Styles" }).click();
    await expect(page.getByText(/new style/i)).toBeVisible({ timeout: 5000 });

    // Click Placements tab
    await page.getByRole("tab", { name: "Placements" }).click();
    await expect(page.getByText(/new placement/i)).toBeVisible({ timeout: 5000 });

    // Click Settings tab
    await page.getByRole("tab", { name: "Settings" }).click();
    await expect(page.getByText(/project settings/i)).toBeVisible({ timeout: 5000 });

    // Click Fonts tab
    await page.getByRole("tab", { name: "Fonts" }).click();
    await expect(page.getByText(/project fonts/i)).toBeVisible({ timeout: 5000 });

    // Click Settings again to toggle back to editor panel
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Settings" }).click();
    // Either the segment editor or "No segment selected" should be visible
    await expect(
      page.getByText("No segment selected").or(page.locator("textarea"))
    ).toBeVisible({ timeout: 5000 });
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
    await page.getByRole("tab", { name: "Settings" }).click();

    // Canvas width/height inputs should be present
    const widthInput = page.locator("input[type='number']").first();
    await expect(widthInput).toBeVisible({ timeout: 5000 });
  });
});
