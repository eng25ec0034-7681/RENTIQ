import { describe, expect, test } from 'vitest';
import { listingSchema } from '@/lib/validation/listingSchema';

describe('listingSchema validation', () => {
  const validListing = {
    title: 'Cozy bike',
    description: 'A well‑maintained mountain bike.',
    category: 'BIKES',
    condition: 'GOOD',
    price: 1200,
    delivery: 'PICKUP',
    college: 'MIT',
    // other optional fields omitted for brevity
  } as any;

  test('accepts valid data', () => {
    const result = listingSchema.safeParse(validListing);
    expect(result.success).toBe(true);
  });

  test('rejects missing required field', () => {
    const { title, ...rest } = validListing;
    const result = listingSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.format()).toHaveProperty('title');
    }
  });

  test('rejects invalid enum value', () => {
    const invalid = { ...validListing, category: 'INVALID' } as any;
    const result = listingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.format()).toHaveProperty('category');
    }
  });
});
