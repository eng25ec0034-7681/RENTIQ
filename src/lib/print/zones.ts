export const PRINT_ZONES = [
  "Library gate",
  "Canteen counter",
  "Hostel block A",
  "Hostel block B",
  "Academic block main gate",
] as const;

export type PrintZone = (typeof PRINT_ZONES)[number];

export function validatePickupZone(zone: unknown): { valid: boolean; error?: string } {
  if (
    typeof zone !== "string" ||
    zone.length < 2 ||
    zone.length > 60 ||
    !(PRINT_ZONES as readonly string[]).includes(zone)
  ) {
    return { valid: false, error: "Invalid pickup zone. Must be in PRINT_ZONES (2-60 characters)." };
  }
  return { valid: true };
}

export function validateFilePath(filePath: unknown, userId: string): { valid: boolean; error?: string } {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    return { valid: false, error: "file_path is required and must be non-empty." };
  }
  if (!filePath.startsWith(`${userId}/`)) {
    return { valid: false, error: "file_path must start with signed-in user id followed by /." };
  }
  return { valid: true };
}

export function buildPrintInsert(userId: string, input: any) {
  return {
    customer_id: userId,
    pages: input.pages,
    copies: input.copies,
    colour: input.colour,
    double_sided: input.doubleSided ?? input.double_sided,
    paper_size: input.paperSize ?? input.paper_size,
    binding: input.binding,
    stapling: input.stapling,
    fulfillment: input.fulfillment,
    payment_method: input.paymentMethod ?? input.payment_method,
    pickup_zone: input.pickup_zone ?? input.pickupZone,
    file_path: input.file_path ?? input.filePath,
  };
}
