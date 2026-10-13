import { z } from "zod";

export const uploadEvidenceSchema = z.object({
  rental_id: z.string().uuid({ message: "Invalid rental ID" }),
  type: z.enum(["HANDOVER", "RETURN"], {
    errorMap: () => ({ message: "Type must be HANDOVER or RETURN" }),
  }),
  photo_paths: z
    .array(z.string())
    .max(6, { message: "Maximum 6 photos allowed" })
    .default([]),
  condition_notes: z
    .string()
    .max(1000, { message: "Condition notes cannot exceed 1000 characters" })
    .optional(),
  damage_notes: z
    .string()
    .max(1000, { message: "Damage notes cannot exceed 1000 characters" })
    .optional(),
});

export type UploadEvidenceInput = z.infer<typeof uploadEvidenceSchema>;
