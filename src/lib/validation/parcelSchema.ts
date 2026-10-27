import { z } from "zod";
import { PRINT_ZONES } from "@/lib/print/zones";
import { MAX_PARCEL_WEIGHT_KG } from "@/lib/parcel/parcelRules";

export const PARCEL_PAYMENT_METHODS = ["CASH", "UPI"] as const;

export const parcelSchema = z.object({
  pickup_zone: z.enum(PRINT_ZONES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Invalid pickup zone. Must be in PRINT_ZONES." }),
  }),
  drop_point: z
    .string({ required_error: "Drop point is required" })
    .trim()
    .min(3, { message: "Drop point must be at least 3 characters" })
    .max(200, { message: "Drop point cannot exceed 200 characters" }),
  item_description: z
    .string({ required_error: "Item description is required" })
    .trim()
    .min(3, { message: "Item description must be at least 3 characters" })
    .max(200, { message: "Item description cannot exceed 200 characters" }),
  weight_kg: z
    .number({ invalid_type_error: "Weight must be a number" })
    .gt(0, { message: "Weight must be greater than 0 kg" })
    .lte(MAX_PARCEL_WEIGHT_KG, {
      message: `Weight cannot exceed ${MAX_PARCEL_WEIGHT_KG} kg`,
    }),
  no_banned_items: z.literal(true, {
    errorMap: () => ({ message: "You must confirm no banned items" }),
  }),
  payment_method: z.enum(PARCEL_PAYMENT_METHODS, {
    errorMap: () => ({ message: "Payment method must be CASH or UPI" }),
  }),
});

export type ParcelInput = z.infer<typeof parcelSchema>;
export type ParcelOrderInput = ParcelInput;
