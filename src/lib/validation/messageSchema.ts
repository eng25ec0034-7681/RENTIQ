import { z } from "zod";

export const sendMessageSchema = z.object({
  conversation_id: z.string().uuid({ message: "Invalid conversation ID" }).optional(),
  listing_id: z.string().uuid({ message: "Invalid listing ID" }).optional(),
  recipient_id: z.string().uuid({ message: "Invalid recipient ID" }).optional(),
  body: z
    .string()
    .min(1, { message: "Message cannot be empty" })
    .max(1000, { message: "Message cannot exceed 1000 characters" })
    .trim(),
});

export const blockUserSchema = z.object({
  blocked_id: z.string().uuid({ message: "Invalid user ID to block" }),
});

export const reportSchema = z.object({
  target_type: z.enum(["USER", "LISTING", "RENTAL", "MESSAGE"]),
  target_id: z.string().min(1, { message: "Target ID required" }),
  reason: z
    .string()
    .min(3, { message: "Reason must be at least 3 characters" })
    .max(1000, { message: "Reason cannot exceed 1000 characters" }),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type BlockUserInput = z.infer<typeof blockUserSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
