import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";
import { transitionRentalSchema } from "@/lib/validation/rentalSchema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserOrThrow();

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = transitionRentalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { to_status, payment_status } = parsed.data;

    const supabase = await createClient();

    // Check rental existence and participant authorization
    const { data: rental, error: fetchErr } = await supabase
      .from("rentals")
      .select("id, renter_id, owner_id, status, payment_status")
      .eq("id", id)
      .single();

    if (fetchErr || !rental) {
      return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    }

    if (rental.renter_id !== user.id && rental.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updates: Record<string, any> = {
      status: to_status,
      updated_at: new Date().toISOString(),
    };

    if (payment_status) {
      updates.payment_status = payment_status;
    }

    const { data: updatedRental, error: updateErr } = await supabase
      .from("rentals")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json({ rental: updatedRental });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}
