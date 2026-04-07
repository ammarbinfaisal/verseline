import { test, expect } from "@playwright/test";
import { uniqueEmail, apiSignup, injectAuth, apiCreateProject, apiDeleteProject } from "./helpers";

test.describe("Projects", () => {
  let token: string;
  const createdProjects: string[] = [];

  test.beforeAll(async () => {
    const email = uniqueEmail();
    const result = await apiSignup(email, "testpass123");
    token = result.token;
  });

  test.afterAll(async () => {
    for (const id of createdProjects) {
      await apiDeleteProject(token, id).catch(() => {});
    }
  });

  test("shows empty state when no projects exist", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto("/projects");
    await expect(page.getByText("No projects yet")).toBeVisible({ timeout: 10_000 });
  });

  test("create project via UI button", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /new project/i }).click();

    // Should navigate to editor for the new project
    await page.waitForURL(/\/projects\/[0-9a-f-]+/, { timeout: 10_000 });
    const url = page.url();
    const projectId = url.split("/projects/")[1];
    if (projectId) createdProjects.push(projectId);

    // Editor should show "Untitled" or similar
    await expect(page.getByText(/untitled/i)).toBeVisible({ timeout: 5000 });
  });

  test("project appears in list after creation", async ({ page }) => {
    const project = await apiCreateProject(token, "E2E Test Project");
    createdProjects.push(project.id);

    await injectAuth(page, token);
    await page.goto("/projects");
    await expect(page.getByText("E2E Test Project")).toBeVisible({ timeout: 10_000 });
  });

  test("clicking project card navigates to editor", async ({ page }) => {
    const project = await apiCreateProject(token, "Click Test");
    createdProjects.push(project.id);

    await injectAuth(page, token);
    await page.goto("/projects");
    await page.getByText("Click Test").click();

    await page.waitForURL(`/projects/${project.id}`, { timeout: 10_000 });
  });
});
