/**
 * Pure function to match partner zones with an order's pickup zone.
 * Trims and compares case-insensitively.
 * Returns false for an empty pickup zone.
 */
export function partnerMatchesZone(partnerZones: string[], pickupZone: string): boolean {
  if (!pickupZone || typeof pickupZone !== 'string') {
    return false;
  }

  const normalizedPickup = pickupZone.trim().toLowerCase();
  if (normalizedPickup.length === 0) {
    return false;
  }

  if (!Array.isArray(partnerZones) || partnerZones.length === 0) {
    return false;
  }

  return partnerZones.some((zone) => {
    if (typeof zone !== 'string') {
      return false;
    }
    return zone.trim().toLowerCase() === normalizedPickup;
  });
}
