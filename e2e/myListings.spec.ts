import { test, expect } from '@playwright/test';

test('my listings page shows listings for authenticated user', async ({ page }) => {
  // Login (adjust selectors as needed for your login page)
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');
  // Wait for redirect to /my-listings
  await page.waitForURL('**/my-listings');
  // Verify at least one listing card appears (ListingCard renders a link to /listing/)
  const firstCard = page.locator("a[href*='/listing/']").first();
  await expect(firstCard).toBeVisible();
});
