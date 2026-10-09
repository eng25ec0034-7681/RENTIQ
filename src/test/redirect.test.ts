import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Mock Supabase SSR module
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null }, // Logged-out user
        }),
      },
    };
  }),
}));

function createTestRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
  });
}

describe("Logged-out User Redirect Middleware", () => {
  it("redirects logged-out user from home page '/' to '/login'", async () => {
    const req = createTestRequest("http://localhost:3000/");
    const res = await updateSession(req);
    expect(res.status).toBe(307); // NextResponse.redirect status
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects logged-out user from '/profile' to '/login'", async () => {
    const req = createTestRequest("http://localhost:3000/profile");
    const res = await updateSession(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("allows logged-out user to access '/login'", async () => {
    const req = createTestRequest("http://localhost:3000/login");
    const res = await updateSession(req);
    expect(res.status).toBe(200);
  });

  it("allows logged-out user to access '/signup'", async () => {
    const req = createTestRequest("http://localhost:3000/signup");
    const res = await updateSession(req);
    expect(res.status).toBe(200);
  });
});
