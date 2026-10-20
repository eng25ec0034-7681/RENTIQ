import { z } from "zod";
import { INDIAN_MOBILE_REGEX } from "./contactSchema";

export const listingCategories = [
  "books",
  "calculators",
  "sports",
  "electronics",
  "projects",
  "events",
  "essentials",
] as const;

export const listingConditions = [
  "LIKE_NEW",
  "GOOD",
  "FAIR",
  "HEAVILY_USED",
] as const;

export const listingSchema = z
  .object({
    title: z.string().min(3, { message: "Title must be at least 3 characters" }).max(80, { message: "Title cannot exceed 80 characters" }),
    category: z.enum(listingCategories, { errorMap: () => ({ message: "Invalid category" }) }),
    description: z.string().max(1000, { message: "Description must be ≤ 1000 characters" }),
    condition: z.enum(listingConditions, { errorMap: () => ({ message: "Invalid condition" }) }),
    price_per_day: z.number().int().min(10, { message: "Price must be ≥ 10" }).max(100, { message: "Price must be ≤ 100" }),
    max_rental_days: z.number().int().min(1, { message: "Min 1 day" }).max(30, { message: "Max 30 days" }).optional(),
    college: z.string().optional(),
    pickup_zone: z.string().optional(),
    delivery_available: z.boolean().optional(),
    pickup_available: z.boolean().optional(),
    rules: z.string().max(500, { message: "Rules ≤ 500 characters" }),
    owner_phone: z
      .string()
      .regex(INDIAN_MOBILE_REGEX, { message: "Phone number must be a valid Indian mobile number (+91 optional, starting with 6-9)" })
      .optional()
      .nullable(),
    share_phone: z.boolean().default(false).optional(),
  })
  .refine(
    (data) => {
      if (data.share_phone) {
        return Boolean(data.owner_phone && data.owner_phone.trim().length > 0 && INDIAN_MOBILE_REGEX.test(data.owner_phone));
      }
      return true;
    },
    {
      message: "Sharing phone number requires a valid Indian mobile number",
      path: ["share_phone"],
    }
  );

export type ListingInput = z.infer<typeof listingSchema>;
