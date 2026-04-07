import { test, expect } from "@playwright/test";
import { uniqueEmail } from "./helpers";

test.describe("Auth", () => {
  test("landing page shows login and signup links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  test("signup creates account and redirects to projects", async ({ page }) => {
    const email = uniqueEmail();
    await page.goto("/signup");

    await page.fill("#email", email);
    await page.fill("#password", "testpass123");
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL("/projects", { timeout: 10_000 });
    await expect(page).toHaveURL("/projects");
  });

  test("login with valid credentials redirects to projects", async ({ page }) => {
    const email = uniqueEmail();
    const password = "testpass123";

    // Create user first
    await page.goto("/signup");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("/projects");

    // Logout
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL("/login");

    // Login
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("/projects", { timeout: 10_000 });
    await expect(page).toHaveURL("/projects");
  });

  test("login with wrong password shows error", async ({ page }) => {
    const email = uniqueEmail();
    const password = "testpass123";

    // Create user first via signup
    await page.goto("/signup");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("/projects");

    // Logout and try wrong password
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL("/login");

    await page.fill("#email", email);
    await page.fill("#password", "wrongpassword");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Invalid credentials")).toBeVisible({ timeout: 5000 });
  });

  test("unauthenticated user is redirected to login from /projects", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForURL("/login", { timeout: 10_000 });
  });

  test("signup with short password shows error", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#email", uniqueEmail());
    await page.fill("#password", "short");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText(/password/i)).toBeVisible({ timeout: 5000 });
  });
});
