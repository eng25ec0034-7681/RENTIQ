import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { POST, DELETE } from '@/app/api/favorites/route';

type MockSupabase = {
  from: (table: string) => {
    insert?: (payload: any) => Promise<any>;
    delete?: () => Promise<any>;
    select?: () => Promise<any>;
    eq?: (col: string, val: any) => any;
    in?: (col: string, vals: any[]) => any;
  };
  auth: { getUser: () => Promise<any> };
};

// Mock supabase client
vi.mock('@/lib/supabase/server', () => {
  return {
    createServerClient: vi.fn(() => mockSupabase),
    getUserOrThrow: vi.fn(async () => ({ id: 'user-123' } as any)),
  };
});

let mockSupabase: MockSupabase;

beforeEach(() => {
  mockSupabase = {
    from: (table: string) => {
      if (table === 'favorites') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          delete: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      }
      if (table === 'listings') {
        return {
          select: vi.fn().mockResolvedValue({ data: [{ id: 'listing-1', title: 'Test Listing' }], error: null }),
          in: vi.fn().mockReturnThis(),
        } as any;
      }
      return {} as any;
    },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
  } as any;
});

describe('Favorites API', () => {
  it('adds a favorite successfully', async () => {
    const request = new Request('', { method: 'POST', body: JSON.stringify({ listing_id: 'listing-1' }) });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it('removes a favorite successfully', async () => {
    const request = new Request('', { method: 'DELETE', body: JSON.stringify({ listing_id: 'listing-1' }) });
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });
});
