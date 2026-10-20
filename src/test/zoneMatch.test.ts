import { describe, it, expect } from "vitest";
import { partnerMatchesZone } from "../lib/partner/zoneMatch";

describe("partnerMatchesZone", () => {
  it("returns true for matching zone", () => {
    expect(partnerMatchesZone(["North Campus", "South Campus"], "North Campus")).toBe(true);
    expect(partnerMatchesZone(["Main Library"], "Main Library")).toBe(true);
  });

  it("handles case difference and trimming correctly", () => {
    expect(partnerMatchesZone(["NORTH CAMPUS"], "north campus")).toBe(true);
    expect(partnerMatchesZone(["  north campus  "], "NORTH CAMPUS")).toBe(true);
    expect(partnerMatchesZone(["Engineering Block"], "  engineering block  ")).toBe(true);
  });

  it("returns false when there is no match", () => {
    expect(partnerMatchesZone(["Hostel Block A", "Hostel Block B"], "Main Gate")).toBe(false);
    expect(partnerMatchesZone(["Zone A"], "Zone B")).toBe(false);
  });

  it("returns false for empty partner zones", () => {
    expect(partnerMatchesZone([], "North Campus")).toBe(false);
  });

  it("returns false for empty pickup zone", () => {
    expect(partnerMatchesZone(["North Campus"], "")).toBe(false);
    expect(partnerMatchesZone(["North Campus"], "   ")).toBe(false);
  });
});
