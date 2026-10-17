import { describe, it, expect } from "vitest";
import {
  canTransition,
  getAllowedTransitions,
  PrintJobStatus,
  ALLOWED_TRANSITIONS,
} from "../lib/partner/jobStatus";

describe("Partner Print Job Status Transitions", () => {
  describe("Valid transitions allowed", () => {
    it("allows standard sequential lifecycle steps", () => {
      expect(canTransition("SEARCHING_PARTNER", "ACCEPTED")).toBe(true);
      expect(canTransition("ACCEPTED", "AT_SHOP")).toBe(true);
      expect(canTransition("AT_SHOP", "PRINTING")).toBe(true);
      expect(canTransition("PRINTING", "PICKED_UP")).toBe(true);
      expect(canTransition("PICKED_UP", "IN_TRANSIT")).toBe(true);
      expect(canTransition("IN_TRANSIT", "ARRIVED_AT_DROP")).toBe(true);
      expect(canTransition("ARRIVED_AT_DROP", "DELIVERED")).toBe(true);
      expect(canTransition("DELIVERED", "COMPLETED")).toBe(true);
    });

    it("allows CANCELLED from any state before PICKED_UP", () => {
      expect(canTransition("SEARCHING_PARTNER", "CANCELLED")).toBe(true);
      expect(canTransition("ACCEPTED", "CANCELLED")).toBe(true);
      expect(canTransition("AT_SHOP", "CANCELLED")).toBe(true);
      expect(canTransition("PRINTING", "CANCELLED")).toBe(true);
    });

    it("returns correct transition lists via getAllowedTransitions", () => {
      expect(getAllowedTransitions("SEARCHING_PARTNER")).toEqual(["ACCEPTED", "CANCELLED"]);
      expect(getAllowedTransitions("PICKED_UP")).toEqual(["IN_TRANSIT"]);
      expect(getAllowedTransitions("DELIVERED")).toEqual(["COMPLETED"]);
      expect(getAllowedTransitions("COMPLETED")).toEqual([]);
      expect(getAllowedTransitions()).toEqual(ALLOWED_TRANSITIONS);
    });
  });

  describe("Skipping a step rejected", () => {
    it("rejects forward skipping between workflow states", () => {
      expect(canTransition("SEARCHING_PARTNER", "AT_SHOP")).toBe(false);
      expect(canTransition("SEARCHING_PARTNER", "PRINTING")).toBe(false);
      expect(canTransition("SEARCHING_PARTNER", "PICKED_UP")).toBe(false);
      expect(canTransition("SEARCHING_PARTNER", "COMPLETED")).toBe(false);
      expect(canTransition("ACCEPTED", "PRINTING")).toBe(false);
      expect(canTransition("ACCEPTED", "PICKED_UP")).toBe(false);
      expect(canTransition("AT_SHOP", "PICKED_UP")).toBe(false);
      expect(canTransition("AT_SHOP", "IN_TRANSIT")).toBe(false);
      expect(canTransition("PRINTING", "IN_TRANSIT")).toBe(false);
      expect(canTransition("PICKED_UP", "ARRIVED_AT_DROP")).toBe(false);
      expect(canTransition("IN_TRANSIT", "DELIVERED")).toBe(false);
      expect(canTransition("ARRIVED_AT_DROP", "COMPLETED")).toBe(false);
    });

    it("rejects backward transitions between workflow states", () => {
      expect(canTransition("ACCEPTED", "SEARCHING_PARTNER")).toBe(false);
      expect(canTransition("AT_SHOP", "ACCEPTED")).toBe(false);
      expect(canTransition("PRINTING", "AT_SHOP")).toBe(false);
      expect(canTransition("PICKED_UP", "PRINTING")).toBe(false);
      expect(canTransition("IN_TRANSIT", "PICKED_UP")).toBe(false);
      expect(canTransition("ARRIVED_AT_DROP", "IN_TRANSIT")).toBe(false);
      expect(canTransition("DELIVERED", "ARRIVED_AT_DROP")).toBe(false);
    });
  });

  describe("CANCELLED after PICKED_UP rejected", () => {
    it("rejects CANCELLED once package has been picked up or later", () => {
      expect(canTransition("PICKED_UP", "CANCELLED")).toBe(false);
      expect(canTransition("IN_TRANSIT", "CANCELLED")).toBe(false);
      expect(canTransition("ARRIVED_AT_DROP", "CANCELLED")).toBe(false);
      expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    });
  });

  describe("COMPLETED to anything rejected", () => {
    const allStatuses: PrintJobStatus[] = [
      "SEARCHING_PARTNER",
      "ACCEPTED",
      "AT_SHOP",
      "PRINTING",
      "PICKED_UP",
      "IN_TRANSIT",
      "ARRIVED_AT_DROP",
      "DELIVERED",
      "COMPLETED",
      "NO_PARTNER_FOUND",
      "CANCELLED",
    ];

    it("rejects transitioning out of COMPLETED to any other status", () => {
      for (const status of allStatuses) {
        expect(canTransition("COMPLETED", status)).toBe(false);
      }
      expect(canTransition("COMPLETED", "ANY_OTHER_STATE")).toBe(false);
    });
  });
});
