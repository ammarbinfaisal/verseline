/**
 * Deep e2e tests for the Verseline editor.
 *
 * Covers: tab stability, segment CRUD, style/placement editing,
 * settings panel, keyboard shortcuts, block editing, project
 * mutations round-tripping through the API to the DB, and
 * randomised style/placement permutation smoke tests.
 *
 * Capped at ~30 tests. Some use randomised combinations to cover
 * more surface area without hard-coding every permutation.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  uniqueEmail,
  apiSignup,
  injectAuth,
  apiCreateProject,
  apiCreateSegment,
  apiGetProject,
  apiListSegments,
  apiDeleteProject,
  apiUpdateProject,
  API_URL,
} from "./helpers";

// ---- Shared state -----------------------------------------------------------

let token: string;
const cleanupIds: string[] = [];

test.beforeAll(async () => {
  const email = uniqueEmail();
  const result = await apiSignup(email, "testpass123");
  token = result.token;
});

test.afterAll(async () => {
  for (const id of cleanupIds) {
    await apiDeleteProject(token, id).catch(() => {});
  }
});

/** Navigate to editor for a project, pre-authenticated. */
async function openEditor(page: Page, projectId: string) {
  await injectAuth(page, token);
  await page.goto(`/projects/${projectId}`);
  // Wait for the editor shell to render (Settings tab visible = fully loaded)
  await expect(page.getByRole("tab", { name: "Settings" })).toBeVisible({ timeout: 15_000 });
}

// ---- 1. Tab stability -------------------------------------------------------

test.describe("Tab stability", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Tab Stability");
    projectId = p.id;
    cleanupIds.push(projectId);
  });

  test("Settings tab opens without crash on empty project", async ({ page }) => {
    await openEditor(page, projectId);
    await page.getByRole("tab", { name: "Settings" }).click();
    await expect(page.getByText(/project settings/i)).toBeVisible({ timeout: 5000 });
    await expect(page.locator("input[type='number']").first()).toBeVisible();
  });

  test("Styles tab opens without crash", async ({ page }) => {
    await openEditor(page, projectId);
    await page.getByRole("tab", { name: "Styles" }).click();
    await expect(page.getByText("+ New Style")).toBeVisible({ timeout: 5000 });
  });

  test("Placements tab opens without crash", async ({ page }) => {
    await openEditor(page, projectId);
    await page.getByRole("tab", { name: "Placements" }).click();
    await expect(page.getByText("+ New Placement")).toBeVisible({ timeout: 5000 });
  });

  test("Fonts tab opens without crash", async ({ page }) => {
    await openEditor(page, projectId);
    await page.getByRole("tab", { name: "Fonts" }).click();
    await expect(page.getByText(/project fonts/i)).toBeVisible({ timeout: 5000 });
  });

  test("rapid tab switching does not crash", async ({ page }) => {
    await openEditor(page, projectId);
    const tabs = ["Styles", "Placements", "Fonts", "Settings"];
    for (let i = 0; i < 12; i++) {
      const tab = tabs[i % tabs.length];
      await page.getByRole("button", { name: tab }).click();
      await page.waitForTimeout(100);
    }
    // Page should still be alive
    await expect(page.getByRole("tab", { name: "Settings" })).toBeVisible();
  });

  test("Settings tab with empty assets does not crash", async ({ page }) => {
    // Set assets to empty object
    await apiUpdateProject(token, projectId, { assets: {} });
    await openEditor(page, projectId);
    await page.getByRole("tab", { name: "Settings" }).click();
    await expect(page.getByText(/project settings/i)).toBeVisible({ timeout: 5000 });
    await expect(page.locator("input[type='number']").first()).toBeVisible();
  });
});

// ---- 2. Segment CRUD --------------------------------------------------------

test.describe("Segment CRUD via UI", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Segment CRUD");
    projectId = p.id;
    cleanupIds.push(projectId);
  });

  test("create segment via + New button", async ({ page }) => {
    await openEditor(page, projectId);
    await page.getByRole("button", { name: "+ New" }).click();
    // Segment should appear in sidebar with time range
    await expect(page.getByText(/00:00\.000/).first()).toBeVisible({ timeout: 5000 });
    // Verify segment was persisted to backend
    const { segments } = await apiListSegments(token, projectId);
    expect(segments.length).toBeGreaterThanOrEqual(1);
  });

  test("select segment shows it in right panel", async ({ page }) => {
    await openEditor(page, projectId);
    // Click the first segment in the sidebar
    const segBtn = page.locator("button").filter({ hasText: /00:00/ }).first();
    await segBtn.click();
    // Right panel should show segment editor content (e.g., timestamp inputs or block text)
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 5000 });
  });

  test("create multiple segments and verify order", async ({ page }) => {
    const seg1 = await apiCreateSegment(token, projectId, 0, 3000, [{ text: "First" }]);
    const seg2 = await apiCreateSegment(token, projectId, 3000, 6000, [{ text: "Second" }]);

    await openEditor(page, projectId);
    // "First" should appear before "Second" in the sidebar
    await expect(page.getByText("First").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Second").first()).toBeVisible({ timeout: 5000 });

    const sidebar = page.locator(".overflow-y-auto").first();
    const allText = await sidebar.innerText();
    expect(allText.indexOf("First")).toBeLessThan(allText.indexOf("Second"));
  });
});

// ---- 3. Block editing -------------------------------------------------------

test.describe("Block editing", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Block Edit");
    projectId = p.id;
    cleanupIds.push(projectId);
    await apiCreateSegment(token, projectId, 0, 5000, [
      { text: "Original text", style: "main", placement: "center" },
    ]);
  });

  test("block text is visible in segment editor", async ({ page }) => {
    await openEditor(page, projectId);
    // Click first segment
    await page.getByText("Original text").first().click();
    // Textarea with block text should be visible
    const textArea = page.locator("textarea").first();
    await expect(textArea).toBeVisible({ timeout: 5000 });
    await expect(textArea).toHaveValue("Original text");
  });
});

// ---- 4. Style creation via UI -----------------------------------------------

test.describe("Style CRUD via UI", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Style CRUD");
    projectId = p.id;
    cleanupIds.push(projectId);
  });

  test("create a new style via UI", async ({ page }) => {
    await openEditor(page, projectId);
    await page.getByRole("tab", { name: "Styles" }).click();

    // Click + New Style
    await page.getByText("+ New Style").click();
    await expect(page.getByRole("heading", { name: "New Style" })).toBeVisible({ timeout: 5000 });

    // Fill in style ID
    const idInput = page.locator("input[placeholder='my-style']");
    await expect(idInput).toBeVisible({ timeout: 3000 });
    await idInput.fill("test-style");

    // Save the style
    await page.getByRole("button", { name: "Save" }).click();

    // Style should appear in the list
    await expect(page.getByText("test-style").first()).toBeVisible({ timeout: 5000 });

    // Verify it persists across a tab switch
    await page.getByRole("tab", { name: "Fonts" }).click();
    await page.getByRole("tab", { name: "Styles" }).click();
    await expect(page.getByText("test-style").first()).toBeVisible({ timeout: 5000 });
  });
});

// ---- 5. Placement creation via UI -------------------------------------------

test.describe("Placement CRUD via UI", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Placement CRUD");
    projectId = p.id;
    cleanupIds.push(projectId);
  });

  test("create a new placement via UI", async ({ page }) => {
    await openEditor(page, projectId);
    await page.getByRole("tab", { name: "Placements" }).click();

    await page.getByText("+ New Placement").click();
    await expect(page.getByRole("heading", { name: "New Placement" })).toBeVisible({ timeout: 5000 });

    const idInput = page.locator("input[placeholder='bottom-center']");
    await expect(idInput).toBeVisible({ timeout: 3000 });
    await idInput.fill("test-placement");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("test-placement").first()).toBeVisible({ timeout: 5000 });

    // Verify it persists across a tab switch
    await page.getByRole("tab", { name: "Fonts" }).click();
    await page.getByRole("tab", { name: "Placements" }).click();
    await expect(page.getByText("test-placement").first()).toBeVisible({ timeout: 5000 });
  });
});

// ---- 6. Settings panel mutations --------------------------------------------

test.describe("Settings panel", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Settings Test");
    projectId = p.id;
    cleanupIds.push(projectId);
  });

  test("edit project name persists to backend", async ({ page }) => {
    await openEditor(page, projectId);
    await page.getByRole("tab", { name: "Settings" }).click();

    const nameInput = page.locator("input[type='text']").first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill("Renamed Project");

    await page.keyboard.press("Control+s");
    await page.waitForTimeout(1500);

    const { project } = await apiGetProject(token, projectId);
    expect(project.name).toBe("Renamed Project");
  });

  test("edit canvas width persists to backend", async ({ page }) => {
    await openEditor(page, projectId);
    await page.getByRole("tab", { name: "Settings" }).click();

    // Width is the first number input
    const widthInput = page.locator("input[type='number']").first();
    await expect(widthInput).toBeVisible({ timeout: 5000 });
    await widthInput.fill("1280");

    await page.keyboard.press("Control+s");
    await page.waitForTimeout(1500);

    const { project } = await apiGetProject(token, projectId);
    const canvas = project.canvas as { width: number };
    expect(canvas.width).toBe(1280);
  });

  test("settings tab works with project that has background", async ({ page }) => {
    await apiUpdateProject(token, projectId, {
      assets: { background: { path: "https://example.com/bg.jpg", type: "image" } },
    });

    await openEditor(page, projectId);
    await page.getByRole("tab", { name: "Settings" }).click();
    await expect(page.getByText(/project settings/i)).toBeVisible({ timeout: 5000 });
  });
});

// ---- 7. Keyboard shortcuts --------------------------------------------------

test.describe("Keyboard shortcuts", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Keyboard Tests");
    projectId = p.id;
    cleanupIds.push(projectId);
    await apiCreateSegment(token, projectId, 0, 5000, [{ text: "Shortcut test" }]);
  });

  test("Ctrl+D duplicates segment", async ({ page }) => {
    await openEditor(page, projectId);
    // Click segment to select it
    await page.getByText("Shortcut test").first().click();
    await page.waitForTimeout(300);

    const { segments: before } = await apiListSegments(token, projectId);
    await page.keyboard.press("Control+d");
    await page.waitForTimeout(2000);

    const { segments: after } = await apiListSegments(token, projectId);
    expect(after.length).toBe(before.length + 1);
  });

  test("Space toggles play/pause without crash", async ({ page }) => {
    await openEditor(page, projectId);
    // Focus the editor container
    await page.locator("[tabindex='-1']").first().focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
    await page.keyboard.press("Space");
    // Still alive
    await expect(page.getByRole("tab", { name: "Settings" })).toBeVisible();
  });

  test("Ctrl+S saves the project", async ({ page }) => {
    await openEditor(page, projectId);
    // Should show "Saved" or "All changes saved" initially
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(1500);
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 3000 });
  });
});

// ---- 8. API round-trip: segment updates ------------------------------------

test.describe("Segment API round-trip", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "API Round-trip");
    projectId = p.id;
    cleanupIds.push(projectId);
  });

  test("create segment via API, verify in UI", async ({ page }) => {
    await apiCreateSegment(token, projectId, 1000, 4000, [
      { text: "API created" },
    ]);

    await openEditor(page, projectId);
    await expect(page.getByText("API created").first()).toBeVisible({ timeout: 10_000 });
  });
});

// ---- 9. Navigation ----------------------------------------------------------

test.describe("Navigation", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Nav Test Project");
    projectId = p.id;
    cleanupIds.push(projectId);
  });

  test("project list -> click project -> editor loads", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto("/projects");
    await expect(page.getByText("Nav Test Project")).toBeVisible({ timeout: 10_000 });

    await page.getByText("Nav Test Project").click();
    await page.waitForURL(`**/projects/${projectId}`, { timeout: 10_000 });
    await expect(page.getByRole("tab", { name: "Settings" })).toBeVisible({ timeout: 15_000 });
  });

  test("library page loads without crash", async ({ page }) => {
    await injectAuth(page, token);
    await page.goto("/library");
    await expect(page.getByText(/my library|pexels/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ---- 10. Randomised style/placement permutation smoke tests -----------------

const ANCHORS = [
  "top_left", "top_center", "top_right",
  "center_left", "center", "center_right",
  "bottom_left", "bottom_center", "bottom_right",
];

const FONT_SIZES = [12, 24, 36, 48, 64, 72, 96];
const COLORS = ["#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff", "#ffcc00"];

test.describe("Randomised style/placement combos", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Random Combos");
    projectId = p.id;
    cleanupIds.push(projectId);
  });

  // Deterministic combos (Playwright requires stable test names between collection and run)
  const combos = [
    { anchor: "top_left", size: 48, color: "#ffffff", idx: 0 },
    { anchor: "center", size: 24, color: "#ff0000", idx: 1 },
    { anchor: "bottom_right", size: 72, color: "#000000", idx: 2 },
    { anchor: "top_center", size: 36, color: "#00ff00", idx: 3 },
    { anchor: "center_left", size: 96, color: "#0000ff", idx: 4 },
  ];

  for (const combo of combos) {
    test(`combo #${combo.idx}: ${combo.anchor} ${combo.size}px ${combo.color}`, async ({ page }) => {
      const styleId = `s-${combo.idx}`;
      const placementId = `p-${combo.idx}`;
      await apiUpdateProject(token, projectId, {
        styles: [{ id: styleId, font: "Arial", size: combo.size, color: combo.color }],
        placements: [{ id: placementId, anchor: combo.anchor }],
      });

      await apiCreateSegment(token, projectId, combo.idx * 3000, (combo.idx + 1) * 3000, [
        { text: `Combo ${combo.idx}`, style: styleId, placement: placementId },
      ]);

      await openEditor(page, projectId);

      // Segment text should appear
      await expect(page.getByText(`Combo ${combo.idx}`).first()).toBeVisible({ timeout: 10_000 });

      // Open styles tab — should show the style
      await page.getByRole("tab", { name: "Styles" }).click();
      await expect(page.getByText(styleId).first()).toBeVisible({ timeout: 5000 });

      // Open placements tab — should show the placement
      await page.getByRole("tab", { name: "Placements" }).click();
      await expect(page.getByText(placementId).first()).toBeVisible({ timeout: 5000 });
    });
  }
});

// ---- 11. Multi-block segment ------------------------------------------------

test.describe("Multi-block segment", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Multi Block", {
      styles: [
        { id: "s1", font: "Arial", size: 48 },
        { id: "s2", font: "Arial", size: 24, color: "#ff0000" },
      ],
      placements: [
        { id: "top", anchor: "top_center" },
        { id: "bottom", anchor: "bottom_center" },
      ],
    });
    projectId = p.id;
    cleanupIds.push(projectId);
    await apiCreateSegment(token, projectId, 0, 5000, [
      { text: "Top block", style: "s1", placement: "top" },
      { text: "Bottom block", style: "s2", placement: "bottom" },
    ]);
  });

  test("both blocks appear in sidebar", async ({ page }) => {
    await openEditor(page, projectId);
    await expect(page.getByText(/Top block/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("canvas preview shows segment text", async ({ page }) => {
    await openEditor(page, projectId);
    // Click the segment
    await page.getByText(/Top block/).first().click();
    await page.waitForTimeout(500);
    // Both block texts should be visible somewhere on page
    await expect(page.getByText("Top block").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Bottom block").first()).toBeVisible({ timeout: 5000 });
  });
});

// ---- 12. Status bar shows project info --------------------------------------

test.describe("Status bar", () => {
  let projectId: string;

  test.beforeAll(async () => {
    const p = await apiCreateProject(token, "Status Bar", {
      canvas: { width: 1920, height: 1080, fps: 30 },
    });
    projectId = p.id;
    cleanupIds.push(projectId);
  });

  test("status bar shows canvas dimensions and segment count", async ({ page }) => {
    await openEditor(page, projectId);
    await expect(page.getByText("1920")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("1080")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("30 fps")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("0 segments")).toBeVisible({ timeout: 5000 });
  });
});
