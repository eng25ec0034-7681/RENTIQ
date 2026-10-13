import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";
import { sendMessageSchema } from "@/lib/validation/messageSchema";

export async function POST(request: Request) {
  // Rate limit: 30 messages/minute per IP
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = checkRateLimit(`messages-create:${ip}`, 30, 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many messages sent. Please slow down." }, { status: 429 });
  }

  try {
    const user = await getUserOrThrow();
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { conversation_id, body: messageBody } = parsed.data;

    if (!conversation_id) {
      return NextResponse.json({ error: "conversation_id is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify conversation and participation
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, renter_id, owner_id")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conv.renter_id !== user.id && conv.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const recipientId = conv.renter_id === user.id ? conv.owner_id : conv.renter_id;

    // Check if blocked by either party
    const { data: block } = await supabase
      .from("blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${user.id})`)
      .limit(1);

    if (block && block.length > 0) {
      return NextResponse.json({ error: "Cannot send message: user is blocked" }, { status: 403 });
    }

    // Insert message
    const { data: newMsg, error: insertErr } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        sender_id: user.id,
        body: messageBody,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return NextResponse.json({ message: newMsg }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}
