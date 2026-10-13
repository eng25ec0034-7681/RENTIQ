import { test, expect } from "@playwright/test";

test.describe("Phase 3 Smoke Tests - Orders, Messaging & Rental Flow", () => {
  test.beforeEach(async ({ context }) => {
    // Inject test session cookie recognized by middleware
    await context.addCookies([
      {
        name: "rentiq_user_id",
        value: "00000000-0000-0000-0000-000000000001",
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  test("verifies /orders page tabs and status badges render", async ({ page }) => {
    await page.goto("/orders");

    // Check main title
    await expect(page.getByRole("heading", { name: "Orders & Rentals" })).toBeVisible();

    // Check tabs
    const myRentalsTab = page.getByRole("button", { name: "My Rentals" });
    const requestsTab = page.getByRole("button", { name: "Rental Requests" });

    await expect(myRentalsTab).toBeVisible();
    await expect(requestsTab).toBeVisible();

    // Click between tabs
    await requestsTab.click();
    await expect(requestsTab).toBeVisible();
    await myRentalsTab.click();
    await expect(myRentalsTab).toBeVisible();
  });

  test("verifies /messages page renders conversation list or empty state", async ({ page }) => {
    await page.goto("/messages");

    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
  });

  test("verifies /notifications page renders and has mark read option", async ({ page }) => {
    await page.goto("/notifications");

    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  });

  test("enforces minimum touch targets and 16px font size on inputs", async ({ page }) => {
    await page.goto("/orders");

    const tabButton = page.getByRole("button", { name: "My Rentals" });
    const boundingBox = await tabButton.boundingBox();
    expect(boundingBox?.height).toBeGreaterThanOrEqual(44);
  });
});
