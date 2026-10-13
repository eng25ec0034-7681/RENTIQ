import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getUserOrThrow } from "@/lib/supabase/server";
import { listingSchema } from "@/lib/validation/listingSchema";

export async function POST(request: Request) {
  // Rate limit: 10 req/min per IP
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed, remaining } = checkRateLimit(`listings-create:${ip}`, 10, 60 * 1000);
  if (!allowed) {
    return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await getUserOrThrow();
  let payload: any;
  try {
    payload = await request.json();
  } catch (_) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = listingSchema.safeParse(payload);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.format() },
      { status: 400 }
    );
  }

  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .insert({ owner_id: user.id, ...parse.data })
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
  }

  return NextResponse.json({ listing: data }, { status: 201 });
}
