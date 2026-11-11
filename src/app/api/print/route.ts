import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";
import { printSchema } from "@/lib/validation/printSchema";
import {
  validateFilePath,
} from "@/lib/print/zones";

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
    fulfillment: "DELIVERY",
    doubleSided: body.doubleSided ?? body.double_sided,
    paperSize: body.paperSize ?? body.paper_size,
    paymentMethod: body.paymentMethod ?? body.payment_method,
    contact_phone: body.contact_phone ?? body.contactPhone,
  };

  const parsed = printSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const rawDropPoint = body.drop_point ?? body.dropPoint;
  if (typeof rawDropPoint !== "string") {
    return NextResponse.json(
      { error: "Validation failed", details: { drop_point: ["Drop point is required"] } },
      { status: 400 }
    );
  }
  const dropPoint = rawDropPoint.trim();
  if (dropPoint.length < 3 || dropPoint.length > 200) {
    return NextResponse.json(
      { error: "Validation failed", details: { drop_point: ["Drop point must be between 3 and 200 characters"] } },
      { status: 400 }
    );
  }

  const filePath = body.file_path ?? body.filePath;
  const fileValidation = validateFilePath(filePath, user.id);
  if (!fileValidation.valid) {
    return NextResponse.json({ error: fileValidation.error }, { status: 400 });
  }

  const insertPayload = {
    customer_id: user.id,
    pages: parsed.data.pages,
    copies: parsed.data.copies,
    colour: parsed.data.colour,
    double_sided: parsed.data.doubleSided,
    paper_size: parsed.data.paperSize,
    binding: parsed.data.binding,
    stapling: parsed.data.stapling,
    fulfillment: "DELIVERY",
    payment_method: parsed.data.paymentMethod,
    drop_point: dropPoint,
    pickup_zone: null,
    file_path: filePath,
    contact_phone: parsed.data.contact_phone,
  };

  const supabase = await createClient();

  const { data: row, error: insertError } = await supabase
    .from("print_orders")
    .insert(insertPayload)
    .select("id, file_path, printing_cost, delivery_fee, platform_fee, total_amount, pickup_zone, drop_point, status, payment_status, created_at")
    .single();

  if (insertError || !row) {
    return NextResponse.json(
      { error: insertError?.message || "Failed to insert print order" },
      { status: 500 }
    );
  }

  const { data: jobId, error: rpcError } = await supabase.rpc("create_print_job", {
    p_order_id: row.id,
  });

  if (rpcError) {
    console.error("Error creating print job:", rpcError);
    return NextResponse.json(
      { error: "Print job could not be created" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      order_id: row.id,
      orderId: row.id,
      file_path: row.file_path,
      filePath: row.file_path,
      printing_cost: row.printing_cost,
      delivery_fee: row.delivery_fee,
      total_amount: row.total_amount,
      job_id: jobId ?? null,
      jobId: jobId ?? null,
    },
    { status: 201 }
  );
}
