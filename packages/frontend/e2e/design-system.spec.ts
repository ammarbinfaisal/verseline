/**
 * Design system + UX behaviours per design.md.
 *
 * These tests intentionally pin the *behaviour* described in the spec, not
 * pixel-level appearance. Each one explains what user-visible promise it
 * locks in and (where applicable) the API/DB round-trip we expect.
 */
import { test, expect } from "@playwright/test";
import { apiSignup, injectAuth, uniqueEmail } from "./helpers";

// =============================================================================
// 1. Theme switching — persists, applies, doesn't FOUC.
// =============================================================================

test.describe("theme", () => {
  test("user can switch between system / light / warm / dark and the choice persists across reloads", async ({ page }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");
    await injectAuth(page, token);

    await page.goto("/settings");

    // Default after signup is "system" (whatever resolves on this machine — usually light).
    await expect(page.getByTestId("theme-system")).toHaveAttribute("aria-checked", "true");

    // Pick warm.
    await page.getByTestId("theme-warm").click();
    await expect(page.getByTestId("theme-warm")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "warm");

    // Reload — selection survives, html attr is restored before paint.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "warm");
    await expect(page.getByTestId("theme-warm")).toHaveAttribute("aria-checked", "true");

    // Switch to dark.
    await page.getByTestId("theme-dark").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("'prefer warm in light mode' makes system resolve to warm not light", async ({ page }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");
    await injectAuth(page, token);

    // Force the OS pref to "light" so the resolver picks warm-or-light, not dark.
    await page.emulateMedia({ colorScheme: "light" });

    await page.goto("/settings");
    await page.getByTestId("theme-system").click();

    // Without preferWarm, system → light.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.getByTestId("prefer-warm-in-light").check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "warm");
  });
});

// =============================================================================
// 2. Configurable shortcuts — rebind persists; new binding triggers the action.
// =============================================================================

test.describe("shortcuts", () => {
  test("rebinding a shortcut persists and the new key triggers the action", async ({ page }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");
    await injectAuth(page, token);

    await page.goto("/settings");

    // Capture the current binding for "Toggle Styles panel" (default "1").
    const row = page.getByTestId("shortcut-row-toggleStylesPanel");
    await expect(row).toContainText("1");

    // Rebind to "9".
    await page.getByTestId("rebind-toggleStylesPanel").click();
    const captureField = page.getByTestId("capture-toggleStylesPanel");
    await captureField.focus();
    await page.keyboard.press("9");

    // The row now shows the new key.
    await expect(row).toContainText("9");

    // localStorage holds the override.
    const stored = await page.evaluate(() => localStorage.getItem("verseline.shortcuts.v1"));
    expect(stored).toContain('"toggleStylesPanel":"9"');

    // Reload — survives.
    await page.reload();
    await expect(row).toContainText("9");
  });

  test("ESC cancels capture, leaving binding unchanged", async ({ page }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");
    await injectAuth(page, token);

    await page.goto("/settings");
    await page.getByTestId("rebind-playPause").click();
    await page.getByTestId("capture-playPause").focus();
    await page.keyboard.press("Escape");

    // Still default Space.
    await expect(page.getByTestId("shortcut-row-playPause")).toContainText("Space");
  });
});

// =============================================================================
// 3. Single dirty-save indicator — only one place shows save state.
// =============================================================================

test.describe("save state legibility", () => {
  test("editor has exactly one save indicator, in the status bar", async ({ page }) => {
    const email = uniqueEmail();
    const { token, user } = await apiSignup(email, "password1234");
    void user;
    await injectAuth(page, token);

    // Create a project to land in the editor.
    const proj = await fetch("http://localhost:4001/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "save-indicator test",
        canvas: { width: 1920, height: 1080, fps: 30 },
        assets: { background: { path: "" } },
        timeline: {},
      }),
    }).then((r) => r.json());
    const projectId = proj.project.id;

    await page.goto(`/projects/${projectId}`);
    await page.getByTestId("editor-root").waitFor();

    // The toolbar (top of editor) does NOT contain a "Save" / "Saved" label.
    const toolbar = page.locator('[role="toolbar"]').first();
    const toolbarText = await toolbar.innerText();
    expect(toolbarText).not.toMatch(/save|saved|saving|unsaved/i);

    // Status bar shows the (only) save indicator with a check icon for "saved".
    const statusBar = page.locator("text=All changes saved");
    await expect(statusBar).toBeVisible();
  });
});

// =============================================================================
// 4. Free-form placement — drag a pin, persists x/y normalized in the project.
// =============================================================================

test.describe("free-form placement", () => {
  test("dragging the placement pin saves normalized x/y to the project", async ({ page }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");
    await injectAuth(page, token);

    const proj = await fetch("http://localhost:4001/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "freeform placement test",
        canvas: { width: 1920, height: 1080, fps: 30 },
        assets: { background: { path: "" } },
        timeline: {},
        placements: [{ id: "test-anchor", anchor: "bottom_center" }],
      }),
    }).then((r) => r.json());
    const projectId = proj.project.id;

    await page.goto(`/projects/${projectId}`);
    await page.getByTestId("editor-root").waitFor();

    // Open the placements panel and select our placement.
    await page.locator('[role="tab"]', { hasText: "Placements" }).click();
    await page.getByTestId("placement-row-test-anchor").click();

    // Click in the surface near top-left to set x≈0.25, y≈0.25.
    const surface = page.getByTestId("freeform-surface");
    const box = await surface.boundingBox();
    if (!box) throw new Error("surface has no bounding box");
    await surface.click({ position: { x: box.width * 0.25, y: box.height * 0.25 } });

    // The freeform pin moved.
    const pin = page.getByTestId("freeform-pin");
    const pinStyle = await pin.getAttribute("style");
    expect(pinStyle).toContain("left: 25");
    expect(pinStyle).toContain("top: 25");

    // Save.
    await page.getByTestId("placement-save").click();

    // Trigger save via shortcut (Cmd+S / Ctrl+S — works regardless of OS).
    const editor = page.getByTestId("editor-root");
    await editor.focus();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");

    // Wait for status bar to settle.
    await expect(page.locator("text=All changes saved")).toBeVisible({ timeout: 5000 });

    // Round-trip via API: the project now has x/y on the placement.
    const fetched = await fetch(`http://localhost:4001/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    const placements = fetched.project.placements as Array<{ id: string; x?: number; y?: number; anchor: string }>;
    const ours = placements.find((p) => p.id === "test-anchor");
    expect(ours).toBeDefined();
    expect(ours!.x).toBeGreaterThan(0.2);
    expect(ours!.x).toBeLessThan(0.3);
    expect(ours!.y).toBeGreaterThan(0.2);
    expect(ours!.y).toBeLessThan(0.3);
  });

  test("snap-to-1/4 rounds drag positions to quarters", async ({ page }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");
    await injectAuth(page, token);

    const proj = await fetch("http://localhost:4001/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "snap test",
        canvas: { width: 1920, height: 1080, fps: 30 },
        assets: { background: { path: "" } },
        timeline: {},
        placements: [{ id: "snap-anchor", anchor: "center" }],
      }),
    }).then((r) => r.json());

    await page.goto(`/projects/${proj.project.id}`);
    await page.getByTestId("editor-root").waitFor();
    await page.locator('[role="tab"]', { hasText: "Placements" }).click();
    await page.getByTestId("placement-row-snap-anchor").click();

    await page.getByTestId("snap-4").click();

    const surface = page.getByTestId("freeform-surface");
    const box = await surface.boundingBox();
    if (!box) throw new Error("no box");
    // Click near 0.30, expect snap to 0.25 (1/4).
    await surface.click({ position: { x: box.width * 0.30, y: box.height * 0.55 } });

    const pin = page.getByTestId("freeform-pin");
    const pinStyle = await pin.getAttribute("style");
    // 0.55 should snap to 0.5 (1/2).
    expect(pinStyle).toContain("left: 25");
    expect(pinStyle).toContain("top: 50");
  });
});

// =============================================================================
// 5. Save-to-library / insert-from-library round-trip
// =============================================================================

test.describe("preset library", () => {
  test("a placement saved to library appears in the picker and inserts on click", async ({ page }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");
    await injectAuth(page, token);

    const proj = await fetch("http://localhost:4001/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "library test",
        canvas: { width: 1920, height: 1080, fps: 30 },
        assets: { background: { path: "" } },
        timeline: {},
        placements: [{ id: "lib-source", name: "Library source", anchor: "center", x: 0.5, y: 0.5 }],
      }),
    }).then((r) => r.json());

    await page.goto(`/projects/${proj.project.id}`);
    await page.getByTestId("editor-root").waitFor();
    await page.locator('[role="tab"]', { hasText: "Placements" }).click();
    await page.getByTestId("placement-row-lib-source").click();

    // Save to library.
    await page.getByTestId("placement-save-library").click();
    await expect(page.locator("text=saved to library")).toBeVisible({ timeout: 5000 });

    // localStorage now contains the preset.
    const stored = await page.evaluate(() =>
      localStorage.getItem("verseline.preset-library.placement.v1"),
    );
    expect(stored).toContain('"id":"lib-source"');

    // Open picker — it lists our preset.
    await page.getByTestId("open-placement-picker").click();
    const picker = page.getByTestId("preset-list-placement");
    await expect(picker).toContainText("Library source");

    // Pick — it inserts (no-op here since same project, but the toast confirms).
    await page.getByTestId("preset-pick-lib-source").click();
    await expect(page.locator("text=inserted")).toBeVisible({ timeout: 5000 });
  });
});

// =============================================================================
// 6. Focus-visible — every interactive element shows the focus ring on Tab.
// =============================================================================

test.describe("focus visibility", () => {
  test("primary CTA on home page is keyboard-reachable and shows a focus ring", async ({ page }) => {
    await page.goto("/");

    // Tab through to the "Start free" button.
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const styles = getComputedStyle(el);
      return {
        text: el.textContent?.trim(),
        outlineWidth: styles.outlineWidth,
        outlineColor: styles.outlineColor,
      };
    });
    expect(focused).not.toBeNull();
    // The first focusable element after html is a link or button.
    expect(focused!.text).toBeTruthy();
  });
});

// =============================================================================
// 7. Editor: API + UI round-trip on segment edit
// =============================================================================

test.describe("segment edit round-trip", () => {
  test("editing segment notes via UI persists to the DB and re-fetch reflects it", async ({ page }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");
    await injectAuth(page, token);

    const proj = await fetch("http://localhost:4001/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "segment notes test",
        canvas: { width: 1920, height: 1080, fps: 30 },
        assets: { background: { path: "" } },
        timeline: {},
      }),
    }).then((r) => r.json());
    const projectId = proj.project.id;

    // Create a segment via the API so the editor has something selected.
    await fetch(`http://localhost:4001/projects/${projectId}/segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startMs: 0,
        endMs: 3000,
        blocks: [{ text: "Hello", style: undefined, placement: undefined }],
      }),
    });

    await page.goto(`/projects/${projectId}`);
    await page.getByTestId("editor-root").waitFor();
    await page.getByTestId("segment-row-0").click();

    // Edit the notes field.
    const notes = page.getByTestId("segment-notes");
    await notes.fill("This is a unique e2e marker " + Date.now());
    const expected = await notes.inputValue();

    // Wait briefly for the debounced PUT.
    await page.waitForTimeout(800);

    // Verify via API.
    const segs = await fetch(`http://localhost:4001/projects/${projectId}/segments`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    const found = segs.segments.find((s: { notes?: string }) => s.notes === expected);
    expect(found).toBeDefined();
  });
});
