import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";
import { parcelSchema } from "@/lib/validation/parcelSchema";

export async function POST(request: Request) {
  let user: { id: string };
  try {
    user = await getUserOrThrow();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalizedBody = {
    ...body,
    pickup_zone: body.pickup_zone ?? body.pickupZone,
    drop_point: body.drop_point ?? body.dropPoint,
    item_description: body.item_description ?? body.itemDescription,
    weight_kg: body.weight_kg ?? body.weightKg,
    no_banned_items: body.no_banned_items ?? body.noBannedItems,
    payment_method: body.payment_method ?? body.paymentMethod,
  };

  const parsed = parcelSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Insert using only the validated fields plus customer_id. Never send any money or status fields.
  const insertPayload = {
    customer_id: user.id,
    pickup_zone: parsed.data.pickup_zone,
    drop_point: parsed.data.drop_point,
    item_description: parsed.data.item_description,
    weight_kg: parsed.data.weight_kg,
    no_banned_items: parsed.data.no_banned_items,
    payment_method: parsed.data.payment_method,
  };

  const supabase = await createClient();

  const { data: row, error: insertError } = await supabase
    .from("parcel_orders")
    .insert(insertPayload)
    .select("id, parcel_fee, platform_fee, total_amount, payment_status, status, created_at")
    .single();

  if (insertError || !row) {
    return NextResponse.json(
      { error: insertError?.message || "Failed to insert parcel order" },
      { status: 500 }
    );
  }

  const { data: jobId, error: rpcError } = await supabase.rpc("create_parcel_job", {
    p_order_id: row.id,
  });

  if (rpcError) {
    console.error("Error creating parcel job:", rpcError);
    return NextResponse.json(
      { error: "Parcel job could not be created" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      order_id: row.id,
      parcel_fee: row.parcel_fee,
      platform_fee: row.platform_fee,
      total_amount: row.total_amount,
      job_id: jobId ?? null,
    },
    { status: 201 }
  );
}
