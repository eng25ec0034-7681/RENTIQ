import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyWebhookSignature } from "@/lib/razorpay";

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  let isValid = false;
  try {
    isValid = verifyWebhookSignature(rawBody, signature);
  } catch {
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);
  const eventName = event?.event;

  try {
    if (eventName === "payment.captured") {
      const paymentEntity = event?.payload?.payment?.entity;
      const paymentId = paymentEntity?.id;
      const orderId = paymentEntity?.order_id;
      const amount = paymentEntity?.amount;

      if (!orderId || !paymentId) {
        return NextResponse.json({ received: true }, { status: 200 });
      }

      // Check print_orders first
      const { data: printOrder } = await adminClient
        .from("print_orders")
        .select("id, total_amount, payment_status")
        .eq("razorpay_order_id", orderId)
        .maybeSingle();

      let matchedTable: "print_orders" | "parcel_orders" | null = null;
      let matchedOrder = printOrder;

      if (matchedOrder) {
        matchedTable = "print_orders";
      } else {
        const { data: parcelOrder } = await adminClient
          .from("parcel_orders")
          .select("id, total_amount, payment_status")
          .eq("razorpay_order_id", orderId)
          .maybeSingle();

        if (parcelOrder) {
          matchedTable = "parcel_orders";
          matchedOrder = parcelOrder;
        }
      }

      if (!matchedTable || !matchedOrder) {
        return NextResponse.json({ received: true }, { status: 200 });
      }

      const expectedAmountPaise = Math.round(Number(matchedOrder.total_amount) * 100);
      if (amount !== expectedAmountPaise) {
        console.warn(
          `Webhook amount mismatch for order ${matchedOrder.id} in ${matchedTable}. Received: ${amount}, Expected: ${expectedAmountPaise}`
        );
        return NextResponse.json({ received: true }, { status: 200 });
      }

      await adminClient
        .from(matchedTable)
        .update({
          payment_status: "PAID",
          razorpay_payment_id: paymentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", matchedOrder.id)
        .eq("payment_status", "PENDING");

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (eventName === "account.activated") {
      const accountId = event?.payload?.account?.entity?.id;
      if (accountId) {
        await adminClient
          .from("partner_profiles")
          .update({
            razorpay_account_status: "activated",
            is_approved: true,
          })
          .eq("razorpay_account_id", accountId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (eventName === "account.suspended" || eventName === "account.rejected") {
      const accountId = event?.payload?.account?.entity?.id;
      const status = eventName === "account.suspended" ? "suspended" : "rejected";
      if (accountId) {
        await adminClient
          .from("partner_profiles")
          .update({
            razorpay_account_status: status,
            is_approved: false,
            is_online: false,
          })
          .eq("razorpay_account_id", accountId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
