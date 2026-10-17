export type PrintJobStatus =
  | 'SEARCHING_PARTNER'
  | 'ACCEPTED'
  | 'AT_SHOP'
  | 'PRINTING'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_DROP'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'NO_PARTNER_FOUND'
  | 'CANCELLED';

export const ALLOWED_TRANSITIONS: Record<PrintJobStatus, readonly PrintJobStatus[]> = {
  SEARCHING_PARTNER: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['AT_SHOP', 'CANCELLED'],
  AT_SHOP: ['PRINTING', 'CANCELLED'],
  PRINTING: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED_AT_DROP'],
  ARRIVED_AT_DROP: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_PARTNER_FOUND: [],
} as const;

export function getAllowedTransitions(from: PrintJobStatus): readonly PrintJobStatus[];
export function getAllowedTransitions(): Record<PrintJobStatus, readonly PrintJobStatus[]>;
export function getAllowedTransitions(from?: string): readonly PrintJobStatus[] | Record<PrintJobStatus, readonly PrintJobStatus[]> {
  if (from) {
    return ALLOWED_TRANSITIONS[from as PrintJobStatus] ?? [];
  }
  return ALLOWED_TRANSITIONS;
}

export function canTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as PrintJobStatus];
  if (!allowed) {
    return false;
  }
  return (allowed as readonly string[]).includes(to);
}
