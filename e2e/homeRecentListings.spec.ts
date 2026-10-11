// e2e/homeRecentListings.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Home page recent listings", () => {
  test("should display Recent Listings section with at least one listing", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // Verify the heading exists
    await expect(page.getByRole("heading", { name: "Recent Listings" })).toBeVisible();
    // Check that at least one ListingCard is rendered (by checking for a link with href containing /listing/)
    const cards = page.locator("a[href*='/listing/']");
    await expect(cards.first()).toBeVisible();
  });
});
