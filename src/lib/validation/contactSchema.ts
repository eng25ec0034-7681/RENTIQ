import { z } from "zod";

/**
 * Regex for Indian mobile numbers:
 * Optional +91 country code, followed by a digit 6-9, followed by 9 digits.
 */
export const INDIAN_MOBILE_REGEX = /^(\+91)?[6-9][0-9]{9}$/;

export const contactSchema = z.object({
  owner_phone: z
    .string()
    .regex(INDIAN_MOBILE_REGEX, {
      message: "Phone number must be a valid Indian mobile number (+91 optional, starting with 6-9)",
    })
    .optional()
    .nullable(),
  share_phone: z.boolean().default(false),
});

export const pickupNoteFieldSchema = z
  .string()
  .min(3, { message: "Pickup note must be at least 3 characters" })
  .max(200, { message: "Pickup note cannot exceed 200 characters" });

export const pickupNoteSchema = z.object({
  pickup_note: pickupNoteFieldSchema,
});

export type ContactInput = z.infer<typeof contactSchema>;
export type PickupNoteInput = z.infer<typeof pickupNoteSchema>;

// Aliases for convenience and consistency across naming conventions
export const listingContactSchema = contactSchema;
export type ListingContactInput = ContactInput;

export const renterPickupNoteSchema = pickupNoteSchema;
export type RenterPickupNoteInput = PickupNoteInput;

export const zoneStringSchema = z
  .string()
  .trim()
  .min(2, { message: "Each zone must be between 2 and 60 characters" })
  .max(60, { message: "Each zone must be between 2 and 60 characters" });

export const partnerZonesSchema = z
  .array(zoneStringSchema)
  .max(10, { message: "Maximum of 10 zones allowed" });

export type PartnerZonesInput = z.infer<typeof partnerZonesSchema>;
