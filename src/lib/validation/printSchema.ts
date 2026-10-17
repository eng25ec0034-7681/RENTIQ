import { z } from "zod";

export const PAPER_SIZES = ["A4", "A3"] as const;
export const PRINT_FULFILLMENT_TYPES = ["PICKUP", "DELIVERY"] as const;
export const PRINT_PAYMENT_METHODS = ["CASH", "UPI"] as const;

export const printSchema = z.object({
  pages: z
    .number()
    .int({ message: "Pages must be an integer" })
    .min(1, { message: "Pages must be at least 1" })
    .max(500, { message: "Pages cannot exceed 500" }),
  copies: z
    .number()
    .int({ message: "Copies must be an integer" })
    .min(1, { message: "Copies must be between 1 and 100" })
    .max(100, { message: "Copies cannot exceed 100" }),
  colour: z.boolean().default(false),
  doubleSided: z.boolean().default(false),
  paperSize: z.enum(PAPER_SIZES, {
    errorMap: () => ({ message: "Paper size must be A4 or A3" }),
  }).default("A4"),
  binding: z.boolean().default(false),
  stapling: z.boolean().default(false),
  fulfillment: z.enum(PRINT_FULFILLMENT_TYPES, {
    errorMap: () => ({ message: "Fulfillment must be PICKUP or DELIVERY" }),
  }).default("PICKUP"),
  paymentMethod: z.enum(PRINT_PAYMENT_METHODS, {
    errorMap: () => ({ message: "Payment method must be CASH or UPI" }),
  }),
});

export const printOrderSchema = printSchema;

export type PrintInput = z.infer<typeof printSchema>;
export type PrintOrderInput = PrintInput;
