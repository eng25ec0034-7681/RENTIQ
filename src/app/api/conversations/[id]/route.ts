import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserOrThrow();

    const supabase = await createClient();

    const { data: conv, error } = await supabase
      .from("conversations")
      .select(`
        id, listing_id, rental_id, renter_id, owner_id, created_at, updated_at,
        listing:listings(id, title, category, price_per_day, college, pickup_zone, listing_photos(storage_path, position)),
        renter:profiles!conversations_renter_id_fkey(id, name, college, profile_photo_url, verification_status),
        owner:profiles!conversations_owner_id_fkey(id, name, college, profile_photo_url, verification_status),
        messages(id, sender_id, body, read_at, created_at)
      `)
      .eq("id", id)
      .single();

    if (error || !conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conv.renter_id !== user.id && conv.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const isOwner = conv.owner_id === user.id;
    const rawOther: any = isOwner ? conv.renter : conv.owner;
    const otherUser = Array.isArray(rawOther) ? rawOther[0] : rawOther;
    const otherUserId = otherUser?.id || (isOwner ? conv.renter_id : conv.owner_id);

    // Check if the other user is currently blocked by current user
    const { data: isBlocked } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", otherUserId)
      .single();

    // Mark unread messages sent by the other party as read
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .neq("sender_id", user.id)
      .is("read_at", null);

    const messages = Array.isArray(conv.messages) ? conv.messages : [];
    messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return NextResponse.json({
      conversation: {
        id: conv.id,
        listing_id: conv.listing_id,
        rental_id: conv.rental_id,
        renter_id: conv.renter_id,
        owner_id: conv.owner_id,
        created_at: conv.created_at,
        listing: conv.listing,
        other_user: otherUser,
        is_blocked: Boolean(isBlocked),
        messages,
      },
      current_user_id: user.id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}
