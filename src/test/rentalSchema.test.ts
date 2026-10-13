import { describe, it, expect } from "vitest";
import {
  createRentalSchema,
  calculateDaysBetween,
  calculateRentalAmounts,
  getTodayDateString,
} from "@/lib/validation/rentalSchema";

describe("Rental Calculation and Schema Validation", () => {
  const today = getTodayDateString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  describe("Price and Days Calculation", () => {
    it("correctly calculates inclusive duration in days", () => {
      expect(calculateDaysBetween(today, today)).toBe(1);
      expect(calculateDaysBetween(today, tomorrow)).toBe(2);
      expect(calculateDaysBetween(today, threeDaysLater)).toBe(4);
    });

    it("accurately computes rental amount with ₹0 deposit and ₹0 platform fee", () => {
      const pricePerDay = 40;
      const pricing = calculateRentalAmounts(pricePerDay, today, threeDaysLater);

      expect(pricing.days).toBe(4);
      expect(pricing.pricePerDay).toBe(40);
      expect(pricing.rentalAmount).toBe(160); // 4 * 40
      expect(pricing.securityDeposit).toBe(0); // ₹0 security deposit
      expect(pricing.platformFee).toBe(0); // ₹0 platform fee
      expect(pricing.totalAmount).toBe(160);
    });

    it("strictly recalculates and ignores any client-sent tampered amount", () => {
      const legitimateListingPrice = 50;
      // Client maliciously attempts to pay ₹1
      const clientPayload = {
        listing_id: "00000000-0000-0000-0000-000000000001",
        start_date: today,
        end_date: tomorrow,
        fulfillment: "PICKUP" as const,
        client_amount: 1, // Tampered client amount
      };

      const parsed = createRentalSchema.safeParse(clientPayload);
      expect(parsed.success).toBe(true);

      // Server recalculation MUST ignore client_amount
      const serverCalculated = calculateRentalAmounts(legitimateListingPrice, clientPayload.start_date, clientPayload.end_date);
      expect(serverCalculated.days).toBe(2);
      expect(serverCalculated.rentalAmount).toBe(100);
      expect(serverCalculated.totalAmount).toBe(100);
      expect(serverCalculated.totalAmount).not.toBe(clientPayload.client_amount);
    });
  });

  describe("Date Boundaries and Validation", () => {
    it("accepts valid start and end dates", () => {
      const payload = {
        listing_id: "00000000-0000-0000-0000-000000000001",
        start_date: today,
        end_date: tomorrow,
        fulfillment: "PICKUP",
      };

      const result = createRentalSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects start dates in the past", () => {
      const payload = {
        listing_id: "00000000-0000-0000-0000-000000000001",
        start_date: yesterday,
        end_date: today,
        fulfillment: "PICKUP",
      };

      const result = createRentalSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.start_date).toContain("Start date cannot be in the past");
      }
    });

    it("rejects end date occurring before start date", () => {
      const payload = {
        listing_id: "00000000-0000-0000-0000-000000000001",
        start_date: tomorrow,
        end_date: today,
        fulfillment: "DELIVERY",
      };

      const result = createRentalSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.end_date).toContain("End date must be on or after start date");
      }
    });

    it("rejects invalid fulfillment options", () => {
      const payload = {
        listing_id: "00000000-0000-0000-0000-000000000001",
        start_date: today,
        end_date: tomorrow,
        fulfillment: "AIR_DROPPED",
      };

      const result = createRentalSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
