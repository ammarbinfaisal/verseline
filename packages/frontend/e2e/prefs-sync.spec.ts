/**
 * Server-side prefs sync — theme + shortcuts persist across browser contexts.
 * See /design.md §V2.6.
 */
import { test, expect } from "@playwright/test";
import { apiSignup, injectAuth, uniqueEmail, API_URL } from "./helpers";

test.describe("prefs sync", () => {
  test("theme set on machine A is visible to a fresh context on machine B", async ({ browser }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");

    // Context A: open settings, switch to "warm".
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await injectAuth(pageA, token);
    await pageA.goto("/settings");
    await pageA.getByTestId("theme-warm").click();
    await expect(pageA.locator("html")).toHaveAttribute("data-theme", "warm");

    // Wait out the 400ms debounce + a margin.
    await pageA.waitForTimeout(900);

    // Verify the server has the change.
    const remote = await fetch(`${API_URL}/me/prefs`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    expect(remote.prefs.theme).toBe("warm");

    // Context B: brand-new browser context, same JWT, no shared localStorage.
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await injectAuth(pageB, token);

    // Land on /projects so the dashboard layout fires hydrateFromServer
    // *before* we check theme. We need the network to settle.
    await pageB.goto("/projects");
    await pageB.waitForLoadState("networkidle");

    // hydrateFromServer applies the theme via applyTheme(); html data-theme
    // should now read "warm".
    await expect(pageB.locator("html")).toHaveAttribute("data-theme", "warm", {
      timeout: 5000,
    });

    await ctxA.close();
    await ctxB.close();
  });

  test("rebinding a shortcut persists across contexts", async ({ browser }) => {
    const email = uniqueEmail();
    const { token } = await apiSignup(email, "password1234");

    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await injectAuth(pageA, token);
    await pageA.goto("/settings");

    // Rebind playPause from Space to "P".
    await pageA.getByTestId("rebind-playPause").click();
    await pageA.getByTestId("capture-playPause").focus();
    await pageA.keyboard.press("p");

    // Debounce window.
    await pageA.waitForTimeout(900);

    // Server has the override.
    const remote = await fetch(`${API_URL}/me/prefs`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    expect(remote.prefs.shortcuts).toMatchObject({ playPause: "P" });

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await injectAuth(pageB, token);
    await pageB.goto("/settings");
    // hydrate
    await pageB.waitForLoadState("networkidle");
    await expect(pageB.getByTestId("shortcut-row-playPause")).toContainText("P");

    await ctxA.close();
    await ctxB.close();
  });
});
