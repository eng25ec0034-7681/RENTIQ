import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/print/route";
import {
  validatePickupZone,
  validateFilePath,
  buildPrintInsert,
} from "@/lib/print/zones";

const { mockInsert, mockRpc, mockSupabase, state } = vi.hoisted(() => {
  const state = {
    lastInsertedRecord: null as any,
    lastRpcParams: null as any,
  };

  const mockInsert = vi.fn((data: any) => {
    state.lastInsertedRecord = data;
    return {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "order-uuid-456",
            file_path: data.file_path,
            printing_cost: 60,
            delivery_fee: 5,
            platform_fee: 3,
            total_amount: 68,
            pickup_zone: data.pickup_zone,
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
    return Promise.resolve({ data: "job-uuid-789", error: null });
  });

  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-test-1" } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "print_orders") {
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
  getUserOrThrow: vi.fn(async () => ({ id: "user-test-1" })),
}));

describe("Print Route Pure Helpers", () => {
  describe("validatePickupZone", () => {
    it("accepts a 2 to 60 character zone, and rejects a 1 character or 61 character zone", () => {
      expect(validatePickupZone("AB").valid).toBe(true);
      expect(validatePickupZone("Custom Gate 4").valid).toBe(true);
      expect(validatePickupZone("A".repeat(60)).valid).toBe(true);
      expect(validatePickupZone("A").valid).toBe(false);
      expect(validatePickupZone("A".repeat(61)).valid).toBe(false);
      expect(validatePickupZone("").valid).toBe(false);
      expect(validatePickupZone(123 as any).valid).toBe(false);
      expect(validatePickupZone(null as any).valid).toBe(false);
    });

    it("accepts valid pickup zones from PRINT_ZONES", () => {
      expect(validatePickupZone("Library gate").valid).toBe(true);
      expect(validatePickupZone("Canteen counter").valid).toBe(true);
      expect(validatePickupZone("Hostel block A").valid).toBe(true);
      expect(validatePickupZone("Hostel block B").valid).toBe(true);
      expect(validatePickupZone("Academic block main gate").valid).toBe(true);
    });
  });

  describe("validateFilePath", () => {
    const currentUserId = "user-123-abc";

    it("rejects a file_path belonging to another user", () => {
      expect(validateFilePath("user-999-other/doc.pdf", currentUserId).valid).toBe(false);
      expect(validateFilePath("hacker/file.pdf", currentUserId).valid).toBe(false);
      expect(validateFilePath("/user-123-abc/doc.pdf", currentUserId).valid).toBe(false);
      expect(validateFilePath("user-123-abc-extra/doc.pdf", currentUserId).valid).toBe(false);
    });

    it("rejects empty or invalid file_path", () => {
      expect(validateFilePath("", currentUserId).valid).toBe(false);
      expect(validateFilePath("   ", currentUserId).valid).toBe(false);
      expect(validateFilePath(null as any, currentUserId).valid).toBe(false);
    });

    it("accepts a file_path starting with the current user's id followed by /", () => {
      expect(validateFilePath(`${currentUserId}/doc-test.pdf`, currentUserId).valid).toBe(true);
      expect(validateFilePath(`${currentUserId}/nested/uuid-doc.docx`, currentUserId).valid).toBe(true);
    });
  });

  describe("buildPrintInsert", () => {
    it("ensures client-sent printing_cost and platform_fee are not present in the insert payload", () => {
      const userId = "user-123-abc";
      const dirtyClientPayload = {
        pages: 15,
        copies: 3,
        colour: true,
        doubleSided: true,
        paperSize: "A4",
        binding: true,
        stapling: false,
        fulfillment: "DELIVERY",
        paymentMethod: "UPI",
        pickup_zone: "Library gate",
        file_path: "user-123-abc/uuid-notes.pdf",
        // Client-sent money / status parameters that MUST be stripped
        printing_cost: 9999,
        platform_fee: 100,
        delivery_fee: 50,
        total_amount: 10149,
        status: "COMPLETED",
        payment_status: "PAID",
      };

      const insertPayload = buildPrintInsert(userId, dirtyClientPayload);

      // Verify client-sent cost and status fields are completely excluded
      expect(insertPayload).not.toHaveProperty("printing_cost");
      expect(insertPayload).not.toHaveProperty("platform_fee");
      expect(insertPayload).not.toHaveProperty("delivery_fee");
      expect(insertPayload).not.toHaveProperty("total_amount");
      expect(insertPayload).not.toHaveProperty("status");
      expect(insertPayload).not.toHaveProperty("payment_status");

      // Verify valid insert structure
      expect(insertPayload).toEqual({
        customer_id: userId,
        pages: 15,
        copies: 3,
        colour: true,
        double_sided: true,
        paper_size: "A4",
        binding: true,
        stapling: false,
        fulfillment: "DELIVERY",
        payment_method: "UPI",
        pickup_zone: "Library gate",
        file_path: "user-123-abc/uuid-notes.pdf",
      });
    });
  });
});

describe("Print Route POST Handler Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.lastInsertedRecord = null;
    state.lastRpcParams = null;
  });

  const validPayload = {
    pages: 5,
    copies: 1,
    colour: false,
    doubleSided: false,
    paperSize: "A4",
    binding: false,
    stapling: false,
    fulfillment: "PICKUP",
    paymentMethod: "CASH",
    pickup_zone: "Library gate",
    file_path: "user-test-1/my-notes.pdf",
  };

  it("accepts a 2 to 60 character pickup zone and rejects a 1 character or 61 character zone via API", async () => {
    const reqValid = new Request("http://localhost:3000/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, pickup_zone: "Custom Gate 4" }),
    });
    const resValid = await POST(reqValid);
    expect(resValid.status).toBe(201);

    const reqShort = new Request("http://localhost:3000/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, pickup_zone: "A" }),
    });
    const resShort = await POST(reqShort);
    expect(resShort.status).toBe(400);
    const jsonShort = await resShort.json();
    expect(jsonShort.error).toMatch(/pickup zone/i);

    const reqLong = new Request("http://localhost:3000/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, pickup_zone: "A".repeat(61) }),
    });
    const resLong = await POST(reqLong);
    expect(resLong.status).toBe(400);
    const jsonLong = await resLong.json();
    expect(jsonLong.error).toMatch(/pickup zone/i);
  });

  it("returns 400 when file_path belongs to another user", async () => {
    const req = new Request("http://localhost:3000/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, file_path: "user-victim-2/their-notes.pdf" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/user id/i);
  });

  it("strips client-sent printing_cost and platform_fee before inserting", async () => {
    const req = new Request("http://localhost:3000/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validPayload,
        printing_cost: 8888,
        platform_fee: 99,
        delivery_fee: 50,
        total_amount: 9000,
        status: "COMPLETED",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    expect(state.lastInsertedRecord).not.toBeNull();
    expect(state.lastInsertedRecord).not.toHaveProperty("printing_cost");
    expect(state.lastInsertedRecord).not.toHaveProperty("platform_fee");
    expect(state.lastInsertedRecord).not.toHaveProperty("delivery_fee");
    expect(state.lastInsertedRecord).not.toHaveProperty("total_amount");

    expect(mockRpc).toHaveBeenCalledWith("create_print_job", {
      p_order_id: "order-uuid-456",
    });

    const json = await responseJson(res);
    expect(json.order_id).toBe("order-uuid-456");
    expect(json.file_path).toBe("user-test-1/my-notes.pdf");
    expect(json.job_id).toBe("job-uuid-789");
    expect(json.printing_cost).toBe(60);
    expect(json.platform_fee).toBe(3);
    expect(json.total_amount).toBe(68);
  });
});

async function responseJson(res: Response) {
  return await res.json();
}
