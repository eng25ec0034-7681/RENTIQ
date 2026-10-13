import { describe, it, expect } from "vitest";

// Emulate the transition matrix enforced by the database trigger
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ["ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"],
  ACCEPTED: ["PAYMENT_PENDING", "CONFIRMED", "CANCELLED"],
  PAYMENT_PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PICKUP_DELIVERY_PENDING", "ITEM_PICKED_UP", "CANCELLED"],
  PICKUP_DELIVERY_PENDING: ["ITEM_PICKED_UP", "CANCELLED"],
  ITEM_PICKED_UP: ["RENTAL_ACTIVE"],
  RENTAL_ACTIVE: ["RETURN_REQUESTED", "RETURN_DELIVERY", "OVERDUE", "DISPUTED", "DAMAGED_REVIEW"],
  RETURN_REQUESTED: ["RETURN_DELIVERY", "RETURNED", "DISPUTED", "DAMAGED_REVIEW"],
  RETURN_DELIVERY: ["RETURNED", "DISPUTED"],
  RETURNED: ["COMPLETED", "DAMAGED_REVIEW", "DISPUTED"],
  DAMAGED_REVIEW: ["DISPUTED", "COMPLETED"],
  DISPUTED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};

function isValidTransition(fromStatus: string, toStatus: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

describe("Rental Status Lifecycle & Transitions", () => {
  describe("Happy Path Workflow", () => {
    it("allows standard sequential lifecycle from request to completion", () => {
      // 1. REQUESTED -> ACCEPTED
      expect(isValidTransition("REQUESTED", "ACCEPTED")).toBe(true);

      // 2. ACCEPTED -> CONFIRMED
      expect(isValidTransition("ACCEPTED", "CONFIRMED")).toBe(true);

      // 3. CONFIRMED -> ITEM_PICKED_UP
      expect(isValidTransition("CONFIRMED", "ITEM_PICKED_UP")).toBe(true);

      // 4. ITEM_PICKED_UP -> RENTAL_ACTIVE
      expect(isValidTransition("ITEM_PICKED_UP", "RENTAL_ACTIVE")).toBe(true);

      // 5. RENTAL_ACTIVE -> RETURN_REQUESTED
      expect(isValidTransition("RENTAL_ACTIVE", "RETURN_REQUESTED")).toBe(true);

      // 6. RETURN_REQUESTED -> RETURNED
      expect(isValidTransition("RETURN_REQUESTED", "RETURNED")).toBe(true);

      // 7. RETURNED -> COMPLETED
      expect(isValidTransition("RETURNED", "COMPLETED")).toBe(true);
    });

    it("allows cancellation before item handover", () => {
      expect(isValidTransition("REQUESTED", "CANCELLED")).toBe(true);
      expect(isValidTransition("ACCEPTED", "CANCELLED")).toBe(true);
      expect(isValidTransition("PAYMENT_PENDING", "CANCELLED")).toBe(true);
      expect(isValidTransition("CONFIRMED", "CANCELLED")).toBe(true);
    });

    it("allows dispute and damage review during active or return stages", () => {
      expect(isValidTransition("RENTAL_ACTIVE", "DISPUTED")).toBe(true);
      expect(isValidTransition("RENTAL_ACTIVE", "DAMAGED_REVIEW")).toBe(true);
      expect(isValidTransition("RETURNED", "DAMAGED_REVIEW")).toBe(true);
      expect(isValidTransition("DAMAGED_REVIEW", "COMPLETED")).toBe(true);
    });
  });

  describe("Invalid & Disallowed Transitions", () => {
    it("rejects jumping directly from REQUESTED to COMPLETED", () => {
      expect(isValidTransition("REQUESTED", "COMPLETED")).toBe(false);
    });

    it("rejects jumping directly from REQUESTED to RENTAL_ACTIVE", () => {
      expect(isValidTransition("REQUESTED", "RENTAL_ACTIVE")).toBe(false);
    });

    it("rejects reviving terminated or completed rentals", () => {
      expect(isValidTransition("COMPLETED", "RENTAL_ACTIVE")).toBe(false);
      expect(isValidTransition("CANCELLED", "RENTAL_ACTIVE")).toBe(false);
      expect(isValidTransition("REJECTED", "ACCEPTED")).toBe(false);
      expect(isValidTransition("EXPIRED", "ACCEPTED")).toBe(false);
    });

    it("rejects cancelling an active rental without dispute", () => {
      expect(isValidTransition("RENTAL_ACTIVE", "CANCELLED")).toBe(false);
    });
  });
});
