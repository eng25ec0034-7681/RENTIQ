import { test, expect } from "@playwright/test";

test.describe("Authentication and Session Redirects", () => {
  test("redirects logged-out user to /login when attempting to access /", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("/login");
    expect(page.url()).toContain("/login");
  });

  test("redirects logged-out user to /login when attempting to access /profile", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL("/login");
    expect(page.url()).toContain("/login");
  });

  test("allows visiting login page and navigating to signup flow", async ({ page }) => {
    await page.goto("/login");

    // Check presence of branding and fields
    await expect(page.locator("h1")).toContainText("RENTIQ");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Click link to signup page
    await page.click('a[href="/signup"]');
    await page.waitForURL("/signup");

    await expect(page.locator("h1")).toContainText("Create Account");
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
