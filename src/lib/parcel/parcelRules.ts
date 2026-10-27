export const MAX_PARCEL_WEIGHT_KG = 5;

export const BANNED_ITEMS_TEXT =
  "Alcohol, cash, valuables, and anything illegal are not allowed. Medicines are allowed only in sealed original packaging, and you are responsible for their legality.";

/**
 * Drop point rule: drop point is free text, 3 to 200 characters, trimmed.
 */
export function validateDropPoint(dropPoint: unknown): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  if (typeof dropPoint !== "string") {
    return {
      valid: false,
      error: "Drop point must be a string.",
    };
  }

  const trimmed = dropPoint.trim();
  if (trimmed.length < 3 || trimmed.length > 200) {
    return {
      valid: false,
      error: "Drop point must be between 3 and 200 characters, trimmed.",
    };
  }

  return {
    valid: true,
    value: trimmed,
  };
}

export function isDropPointValid(dropPoint: unknown): boolean {
  return validateDropPoint(dropPoint).valid;
}
