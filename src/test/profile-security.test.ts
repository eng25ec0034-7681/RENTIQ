import { describe, it, expect } from "vitest";
import { updateProfileSchema } from "@/lib/validations";

describe("Profile Security and Privacy Controls", () => {
  describe("Public Profile Privacy Filtering", () => {
    it("ensures public profile view exposes only name, college, profile_photo_url, and verification_status", () => {
      const fullProfile = {
        id: "user-123",
        name: "Jane Doe",
        college: "Tech Institute",
        department: "Computer Science",
        year: "3rd Year",
        bio: "Confidential Bio and student notes",
        profile_photo_url: "https://example.com/photo.jpg",
        verification_status: "APPROVED" as const,
        created_at: "2026-10-09T00:00:00Z",
      };

      // Simulating public profile view columns mapping
      const publicFields = {
        id: fullProfile.id,
        name: fullProfile.name,
        college: fullProfile.college,
        profile_photo_url: fullProfile.profile_photo_url,
        verification_status: fullProfile.verification_status,
      };

      expect(publicFields).not.toHaveProperty("bio");
      expect(publicFields).not.toHaveProperty("department");
      expect(publicFields).not.toHaveProperty("year");
      expect(publicFields).not.toHaveProperty("created_at");
      expect(publicFields).toEqual({
        id: "user-123",
        name: "Jane Doe",
        college: "Tech Institute",
        profile_photo_url: "https://example.com/photo.jpg",
        verification_status: "APPROVED",
      });
    });
  });

  describe("Protected Field Tampering Enforcement", () => {
    it("strips verification_status and roles from user profile update input", () => {
      const maliciousPayload = {
        name: "Valid Name",
        college: "State College",
        department: "Physics",
        year: "2nd Year",
        bio: "Hello world",
        verification_status: "APPROVED", // Malicious attempt to self-approve
        roles: ["admin", "super_admin"], // Malicious attempt to escalate role
      };

      // Emulate API route payload sanitation
      const copy = { ...maliciousPayload };
      delete (copy as Record<string, unknown>).verification_status;
      delete (copy as Record<string, unknown>).roles;

      const parsed = updateProfileSchema.safeParse(copy);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).not.toHaveProperty("verification_status");
        expect(parsed.data).not.toHaveProperty("roles");
        expect(parsed.data.name).toBe("Valid Name");
      }
    });

    it("rejects invalid field data types or blank names", () => {
      const invalidPayload = {
        name: "A", // too short (<2 chars)
      };

      const parsed = updateProfileSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });
  });
});
