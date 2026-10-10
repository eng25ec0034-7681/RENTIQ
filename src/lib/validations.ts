import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  college: z.string().max(100, "College name is too long").default(""),
  department: z.string().max(100, "Department is too long").default(""),
  year: z.string().max(20, "Year is too long").default(""),
  bio: z.string().max(500, "Bio must be under 500 characters").default(""),
});

// Photo upload validation parameters
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: "Invalid file type. Only JPG, PNG, and WebP are allowed." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File size exceeds the 2 MB limit." };
  }
  return { valid: true };
}
