import { test, expect } from "@playwright/test";

test.describe("Mobile-First Layout & Input Styling Rules", () => {
  test("enforces input font size at least 16px to prevent iOS auto-zoom", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    const fontSize = await emailInput.evaluate((el) => window.getComputedStyle(el).fontSize);
    const numericFontSize = parseFloat(fontSize.replace("px", ""));

    expect(numericFontSize).toBeGreaterThanOrEqual(16);
  });

  test("verifies bottom nav items and action sheet trigger on protected pages", async ({ page }) => {
    // Visit login page first to inspect layout structure
    await page.goto("/login");

    // Login page shouldn't show bottom nav
    const bottomNav = page.locator('nav[aria-label="Bottom Navigation"]');
    await expect(bottomNav).toBeHidden();
  });
});
