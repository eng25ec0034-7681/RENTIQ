import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validation/messageSchema";

export async function POST(request: Request) {
  try {
    const user = await getUserOrThrow();
    const body = await request.json();

    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { target_type, target_id, reason } = parsed.data;

    const supabase = await createClient();

    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        reporter_id: user.id,
        target_type,
        target_id,
        reason,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}
