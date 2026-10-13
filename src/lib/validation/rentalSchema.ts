import { z } from "zod";

export const RENTAL_STATUSES = [
  "REQUESTED",
  "ACCEPTED",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "PICKUP_DELIVERY_PENDING",
  "ITEM_PICKED_UP",
  "RENTAL_ACTIVE",
  "RETURN_REQUESTED",
  "RETURN_DELIVERY",
  "RETURNED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "OVERDUE",
  "DISPUTED",
  "DAMAGED_REVIEW",
] as const;

export const FULFILLMENT_TYPES = ["PICKUP", "DELIVERY"] as const;
export const PAYMENT_METHODS = ["CASH", "UPI"] as const;
export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateDaysBetween(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Inclusive
}

export function calculateRentalAmounts(
  pricePerDay: number,
  startDateStr: string,
  endDateStr: string
) {
  const days = calculateDaysBetween(startDateStr, endDateStr);
  const validDays = Math.max(1, days);
  const rentalAmount = validDays * pricePerDay;
  const securityDeposit = 0;
  const platformFee = 0;
  const totalAmount = rentalAmount + securityDeposit + platformFee;

  return {
    days: validDays,
    pricePerDay,
    rentalAmount,
    securityDeposit,
    platformFee,
    totalAmount,
  };
}

export const createRentalSchema = z
  .object({
    listing_id: z.string().uuid({ message: "Invalid listing ID" }),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid start date format (YYYY-MM-DD)" }),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid end date format (YYYY-MM-DD)" }),
    fulfillment: z.enum(FULFILLMENT_TYPES, {
      errorMap: () => ({ message: "Fulfillment must be PICKUP or DELIVERY" }),
    }),
    message: z.string().max(500, { message: "Message cannot exceed 500 characters" }).optional(),
    payment_method: z.enum(PAYMENT_METHODS).default("CASH"),
    client_amount: z.number().optional(), // Client may send for UI, but server MUST ignore/recalculate
  })
  .refine(
    (data) => {
      const today = getTodayDateString();
      return data.start_date >= today;
    },
    {
      message: "Start date cannot be in the past",
      path: ["start_date"],
    }
  )
  .refine(
    (data) => {
      return data.end_date >= data.start_date;
    },
    {
      message: "End date must be on or after start date",
      path: ["end_date"],
    }
  );

export const transitionRentalSchema = z.object({
  to_status: z.enum(RENTAL_STATUSES, {
    errorMap: () => ({ message: "Invalid status transition" }),
  }),
  note: z.string().max(500).optional(),
  payment_status: z.enum(PAYMENT_STATUSES).optional(),
});

export type CreateRentalInput = z.infer<typeof createRentalSchema>;
export type TransitionRentalInput = z.infer<typeof transitionRentalSchema>;
