import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await getUserOrThrow();

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_listing_contact", {
      p_listing_id: id,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Unable to reveal contact information" },
        { status: 400 }
      );
    }

    return NextResponse.json({ phone: data ?? null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("authenticated") ? 401 : 500 }
    );
  }
}
