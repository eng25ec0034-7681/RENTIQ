import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/parcel/route";
import { parcelSchema } from "@/lib/validation/parcelSchema";
import {
  MAX_PARCEL_WEIGHT_KG,
  BANNED_ITEMS_TEXT,
  validateDropPoint,
} from "@/lib/parcel/parcelRules";
import { PRINT_ZONES } from "@/lib/print/zones";

const { mockInsert, mockRpc, mockSupabase, state } = vi.hoisted(() => {
  const state = {
    lastInsertedRecord: null as any,
    lastRpcParams: null as any,
    rpcShouldFail: false,
  };

  const mockInsert = vi.fn((data: any) => {
    state.lastInsertedRecord = data;
    return {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "parcel-order-uuid-123",
            parcel_fee: 10,
            platform_fee: 3,
            total_amount: 13,
            status: "PLACED",
            payment_status: "PENDING",
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      })),
    };
  });

  const mockRpc = vi.fn((fnName: string, params: any) => {
    state.lastRpcParams = { fnName, params };
    if (state.rpcShouldFail) {
      return Promise.resolve({ data: null, error: { message: "RPC failed" } });
    }
    return Promise.resolve({ data: "parcel-job-uuid-456", error: null });
  });

  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-parcel-test-1" } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "parcel_orders") {
        return { insert: mockInsert };
      }
      return {} as any;
    }),
    rpc: mockRpc,
  };

  return { mockInsert, mockRpc, mockSupabase, state };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSupabase),
  createServerClient: vi.fn(() => mockSupabase),
  getUserOrThrow: vi.fn(async () => ({ id: "user-parcel-test-1" })),
}));

describe("Parcel Rules and Pure Helpers", () => {
  it("exports MAX_PARCEL_WEIGHT_KG as 5", () => {
    expect(MAX_PARCEL_WEIGHT_KG).toBe(5);
  });

  it("exports the required BANNED_ITEMS_TEXT", () => {
    expect(BANNED_ITEMS_TEXT).toBe(
      "Alcohol, cash, valuables, and anything illegal are not allowed. Medicines are allowed only in sealed original packaging, and you are responsible for their legality."
    );
  });

  it("validates drop point free text between 3 and 200 characters (trimmed)", () => {
    expect(validateDropPoint("AB").valid).toBe(false);
    expect(validateDropPoint("  AB  ").valid).toBe(false);
    expect(validateDropPoint("").valid).toBe(false);
    expect(validateDropPoint(123 as any).valid).toBe(false);
    expect(validateDropPoint("Room 304, Hostel A").valid).toBe(true);
    expect(validateDropPoint("a".repeat(201)).valid).toBe(false);
    expect(validateDropPoint("a".repeat(200)).valid).toBe(true);
  });
});

describe("Parcel Schema Validation", () => {
  const validBase = {
    pickup_zone: PRINT_ZONES[0],
    drop_point: "Academic Block Room 101",
    item_description: "Textbooks and notebook",
    weight_kg: 2.5,
    no_banned_items: true,
    payment_method: "CASH",
  };

  it("8.1 Weight 5.5 kg is rejected; 5 kg is accepted", () => {
    const rejectedResult = parcelSchema.safeParse({ ...validBase, weight_kg: 5.5 });
    expect(rejectedResult.success).toBe(false);

    const acceptedResult = parcelSchema.safeParse({ ...validBase, weight_kg: 5 });
    expect(acceptedResult.success).toBe(true);
  });

  it("8.2 A pickup zone not in PRINT_ZONES is rejected", () => {
    const res = parcelSchema.safeParse({ ...validBase, pickup_zone: "Random Unknown Zone" });
    expect(res.success).toBe(false);

    const validZoneRes = parcelSchema.safeParse({ ...validBase, pickup_zone: PRINT_ZONES[0] });
    expect(validZoneRes.success).toBe(true);
  });

  it("8.3 Drop point of 2 characters is rejected", () => {
    const res2Chars = parcelSchema.safeParse({ ...validBase, drop_point: "AB" });
    expect(res2Chars.success).toBe(false);

    const resTrimmed2Chars = parcelSchema.safeParse({ ...validBase, drop_point: "  AB  " });
    expect(resTrimmed2Chars.success).toBe(false);

    const res3Chars = parcelSchema.safeParse({ ...validBase, drop_point: "ABC" });
    expect(res3Chars.success).toBe(true);
  });

  it("8.4 no_banned_items = false is rejected", () => {
    const res = parcelSchema.safeParse({ ...validBase, no_banned_items: false });
    expect(res.success).toBe(false);

    const resTrue = parcelSchema.safeParse({ ...validBase, no_banned_items: true });
    expect(resTrue.success).toBe(true);
  });
});

describe("Parcel Route POST Integration Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.lastInsertedRecord = null;
    state.lastRpcParams = null;
    state.rpcShouldFail = false;
  });

  const validPayload = {
    pickup_zone: PRINT_ZONES[0],
    drop_point: "Library 2nd Floor Reference Desk",
    item_description: "Graphing calculator and notes",
    weight_kg: 1.5,
    no_banned_items: true,
    payment_method: "UPI",
  };

  it("8.1 Rejects weight_kg of 5.5 kg and accepts weight_kg of 5 kg via API", async () => {
    // 5.5 kg should return 400
    const reqRejected = new Request("http://localhost:3000/api/parcel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, weight_kg: 5.5 }),
    });
    const resRejected = await POST(reqRejected);
    expect(resRejected.status).toBe(400);

    // 5 kg should return 201
    const reqAccepted = new Request("http://localhost:3000/api/parcel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, weight_kg: 5 }),
    });
    const resAccepted = await POST(reqAccepted);
    expect(resAccepted.status).toBe(201);
  });

  it("8.2 Rejects pickup zone not in PRINT_ZONES via API", async () => {
    const req = new Request("http://localhost:3000/api/parcel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, pickup_zone: "Unregistered Gate 9" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details?.pickup_zone).toBeDefined();
  });

  it("8.3 Rejects drop point of 2 characters via API", async () => {
    const req = new Request("http://localhost:3000/api/parcel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, drop_point: "D2" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details?.drop_point).toBeDefined();
  });

  it("8.4 Rejects no_banned_items = false via API", async () => {
    const req = new Request("http://localhost:3000/api/parcel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, no_banned_items: false }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details?.no_banned_items).toBeDefined();
  });

  it("8.5 Client-sent parcel_fee, platform_fee and total_amount are never inserted", async () => {
    const dirtyPayload = {
      ...validPayload,
      parcel_fee: 9999,
      platform_fee: 500,
      total_amount: 10499,
      status: "DELIVERED",
      payment_status: "PAID",
    };

    const req = new Request("http://localhost:3000/api/parcel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dirtyPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    // Verify insert payload contains customer_id and valid fields only
    expect(state.lastInsertedRecord).not.toBeNull();
    expect(state.lastInsertedRecord.customer_id).toBe("user-parcel-test-1");
    expect(state.lastInsertedRecord.pickup_zone).toBe(validPayload.pickup_zone);
    expect(state.lastInsertedRecord.drop_point).toBe(validPayload.drop_point);
    expect(state.lastInsertedRecord.item_description).toBe(validPayload.item_description);
    expect(state.lastInsertedRecord.weight_kg).toBe(validPayload.weight_kg);
    expect(state.lastInsertedRecord.no_banned_items).toBe(true);
    expect(state.lastInsertedRecord.payment_method).toBe(validPayload.payment_method);

    // Verify client money and status fields were completely excluded
    expect(state.lastInsertedRecord).not.toHaveProperty("parcel_fee");
    expect(state.lastInsertedRecord).not.toHaveProperty("platform_fee");
    expect(state.lastInsertedRecord).not.toHaveProperty("total_amount");
    expect(state.lastInsertedRecord).not.toHaveProperty("status");
    expect(state.lastInsertedRecord).not.toHaveProperty("payment_status");

    // Verify RPC was called
    expect(mockRpc).toHaveBeenCalledWith("create_parcel_job", {
      p_order_id: "parcel-order-uuid-123",
    });

    // Verify response
    const json = await res.json();
    expect(json).toEqual({
      order_id: "parcel-order-uuid-123",
      parcel_fee: 10,
      platform_fee: 3,
      total_amount: 13,
      job_id: "parcel-job-uuid-456",
    });
  });

  it("Returns 500 when create_parcel_job RPC returns an error", async () => {
    state.rpcShouldFail = true;

    const req = new Request("http://localhost:3000/api/parcel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Parcel job could not be created");
  });
});
