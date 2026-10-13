import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";
import { createRentalSchema, calculateRentalAmounts } from "@/lib/validation/rentalSchema";

export async function GET(request: Request) {
  try {
    const user = await getUserOrThrow();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role"); // "renter" | "owner" | null

    const supabase = await createClient();

    // Lazy cleanup of expired requests
    try {
      await supabase.rpc("expire_stale_rental_requests");
    } catch {
      // Safe fallback if RPC is pending
    }

    let query = supabase
      .from("rentals")
      .select(`
        *,
        listing:listings(id, title, category, price_per_day, college, pickup_zone, delivery_available, pickup_available, listing_photos(storage_path, position)),
        renter:profiles!rentals_renter_id_fkey(id, name, college, profile_photo_url, verification_status),
        owner:profiles!rentals_owner_id_fkey(id, name, college, profile_photo_url, verification_status)
      `)
      .order("created_at", { ascending: false });

    if (role === "renter") {
      query = query.eq("renter_id", user.id);
    } else if (role === "owner") {
      query = query.eq("owner_id", user.id);
    } else {
      query = query.or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rentals: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  // Sliding-window rate limit: 10 rental requests/minute per IP
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = checkRateLimit(`rentals-create:${ip}`, 10, 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  try {
    const user = await getUserOrThrow();
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = createRentalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { listing_id, start_date, end_date, fulfillment, message, payment_method } = parsed.data;

    const supabase = await createClient();

    // Fetch listing from DB
    const { data: listing, error: listingErr } = await supabase
      .from("listings")
      .select("id, owner_id, title, price_per_day, max_rental_days, status")
      .eq("id", listing_id)
      .single();

    if (listingErr || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.status !== "ACTIVE") {
      return NextResponse.json({ error: "This listing is currently unavailable for rent." }, { status: 400 });
    }

    if (listing.owner_id === user.id) {
      return NextResponse.json({ error: "You cannot rent your own item." }, { status: 400 });
    }

    // Check if user is blocked by owner or vice versa
    const { data: blockExists } = await supabase
      .from("blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${listing.owner_id}),and(blocker_id.eq.${listing.owner_id},blocked_id.eq.${user.id})`)
      .limit(1);

    if (blockExists && blockExists.length > 0) {
      return NextResponse.json({ error: "Unable to request rental due to user restrictions." }, { status: 403 });
    }

    // Recalculate price on the server (NEVER trust client amounts)
    const pricing = calculateRentalAmounts(listing.price_per_day, start_date, end_date);

    if (listing.max_rental_days && pricing.days > listing.max_rental_days) {
      return NextResponse.json(
        { error: `Requested duration exceeds the maximum limit of ${listing.max_rental_days} days.` },
        { status: 400 }
      );
    }

    // Prevent overlapping bookings with active rentals
    const { data: overlappingRentals } = await supabase
      .from("rentals")
      .select("id, start_date, end_date, status")
      .eq("listing_id", listing_id)
      .in("status", [
        "ACCEPTED",
        "PAYMENT_PENDING",
        "CONFIRMED",
        "PICKUP_DELIVERY_PENDING",
        "ITEM_PICKED_UP",
        "RENTAL_ACTIVE",
        "RETURN_REQUESTED",
        "RETURN_DELIVERY",
      ])
      .lte("start_date", end_date)
      .gte("end_date", start_date);

    if (overlappingRentals && overlappingRentals.length > 0) {
      return NextResponse.json(
        { error: "The selected dates overlap with an already confirmed booking for this item." },
        { status: 409 }
      );
    }

    // Insert new rental
    const { data: newRental, error: insertErr } = await supabase
      .from("rentals")
      .insert({
        listing_id,
        renter_id: user.id,
        owner_id: listing.owner_id,
        start_date,
        end_date,
        days: pricing.days,
        price_per_day: pricing.pricePerDay,
        rental_amount: pricing.rentalAmount,
        security_deposit: pricing.securityDeposit,
        platform_fee: pricing.platformFee,
        total_amount: pricing.totalAmount,
        fulfillment,
        message: message || null,
        payment_method,
        payment_status: "PENDING",
        status: "REQUESTED",
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ rental: newRental }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}
