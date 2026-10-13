import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";
import { blockUserSchema } from "@/lib/validation/messageSchema";

export async function POST(request: Request) {
  try {
    const user = await getUserOrThrow();
    const body = await request.json();

    const parsed = blockUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const { blocked_id } = parsed.data;

    if (blocked_id === user.id) {
      return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("blocks")
      .upsert({ blocker_id: user.id, blocked_id });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "User blocked successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserOrThrow();
    const body = await request.json();

    const parsed = blockUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const { blocked_id } = parsed.data;
    const supabase = await createClient();

    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", blocked_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "User unblocked successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}
