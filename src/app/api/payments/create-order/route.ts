import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";
import { createRazorpayOrder } from "@/lib/razorpay";

const createOrderSchema = z.object({
  kind: z.enum(["PRINT", "PARCEL"]),
  order_id: z.string().min(1, "order_id is required"),
});

export async function POST(request: Request) {
  let user: { id: string };
  try {
    user = await getUserOrThrow();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { kind, order_id } = parsed.data;
  const tableName = kind === "PRINT" ? "print_orders" : "parcel_orders";

  const supabase = await createClient();
  const { data: order, error: fetchError } = await supabase
    .from(tableName)
    .select("id, customer_id, total_amount, payment_status, payment_method, razorpay_order_id")
    .eq("id", order_id)
    .maybeSingle();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.customer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (order.payment_status === "PAID" || order.payment_method !== "ONLINE") {
    return NextResponse.json(
      {
        error:
          order.payment_status === "PAID"
            ? "Order is already paid"
            : "Payment method must be ONLINE",
      },
      { status: 409 }
    );
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const amountPaise = Math.round(Number(order.total_amount) * 100);

  if (order.razorpay_order_id) {
    return NextResponse.json({
      razorpay_order_id: order.razorpay_order_id,
      amount: amountPaise,
      currency: "INR",
      key_id: keyId,
    });
  }

  let razorpayOrder: any;
  try {
    razorpayOrder = await createRazorpayOrder(amountPaise, `rcpt_${order_id}`, {
      kind,
      order_id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create Razorpay order" },
      { status: 502 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);
  const { error: updateError } = await adminClient
    .from(tableName)
    .update({ razorpay_order_id: razorpayOrder.id })
    .eq("id", order.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to update order with Razorpay order ID" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    razorpay_order_id: razorpayOrder.id,
    amount: amountPaise,
    currency: "INR",
    key_id: keyId,
  });
}
