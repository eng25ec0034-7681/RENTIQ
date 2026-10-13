import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getUserOrThrow();
    const supabase = await createClient();

    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, body, link, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const unreadCount = (notifications || []).filter((n: any) => !n.read_at).length;

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getUserOrThrow();
    const body = await request.json().catch(() => ({}));
    const { notification_id, mark_all } = body;

    const supabase = await createClient();

    if (mark_all) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);
    } else if (notification_id) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notification_id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}
