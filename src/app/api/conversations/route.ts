import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getUserOrThrow();
    const supabase = await createClient();

    // Fetch conversations where user is renter or owner
    const { data: convs, error } = await supabase
      .from("conversations")
      .select(`
        id, listing_id, rental_id, renter_id, owner_id, created_at, updated_at,
        listing:listings(id, title, category, price_per_day, listing_photos(storage_path, position)),
        renter:profiles!conversations_renter_id_fkey(id, name, college, profile_photo_url, verification_status),
        owner:profiles!conversations_owner_id_fkey(id, name, college, profile_photo_url, verification_status),
        messages(id, sender_id, body, read_at, created_at)
      `)
      .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const conversations = (convs || []).map((c: any) => {
      const isOwner = c.owner_id === user.id;
      const rawOther: any = isOwner ? c.renter : c.owner;
      const otherUser = Array.isArray(rawOther) ? rawOther[0] : rawOther;

      // Extract last message
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastMessage = msgs[0] || null;

      // Count unread messages sent by the other party
      const unreadCount = msgs.filter((m: any) => m.sender_id !== user.id && !m.read_at).length;

      return {
        id: c.id,
        listing_id: c.listing_id,
        rental_id: c.rental_id,
        renter_id: c.renter_id,
        owner_id: c.owner_id,
        created_at: c.created_at,
        updated_at: c.updated_at,
        listing: c.listing,
        other_user: otherUser,
        last_message: lastMessage,
        unread_count: unreadCount,
      };
    });

    return NextResponse.json({ conversations });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserOrThrow();
    const { listing_id } = await request.json();

    if (!listing_id) {
      return NextResponse.json({ error: "listing_id is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch listing
    const { data: listing, error: listErr } = await supabase
      .from("listings")
      .select("id, owner_id")
      .eq("id", listing_id)
      .single();

    if (listErr || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.owner_id === user.id) {
      return NextResponse.json({ error: "Cannot start conversation with yourself" }, { status: 400 });
    }

    // Check if blocked
    const { data: block } = await supabase
      .from("blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${listing.owner_id}),and(blocker_id.eq.${listing.owner_id},blocked_id.eq.${user.id})`)
      .limit(1);

    if (block && block.length > 0) {
      return NextResponse.json({ error: "Cannot start conversation due to user block" }, { status: 403 });
    }

    // Check for existing conversation for this listing & renter
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listing_id)
      .eq("renter_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ conversation_id: existing.id });
    }

    // Create conversation
    const { data: created, error: insertErr } = await supabase
      .from("conversations")
      .insert({
        listing_id,
        renter_id: user.id,
        owner_id: listing.owner_id,
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ conversation_id: created.id }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}
