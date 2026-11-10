import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";

const payoutBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email address"),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile must be 10 digits"),
  pan: z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN must be in format AAAAA9999A"),
  accountNumber: z.string().trim().regex(/^\d{9,18}$/, "Account number must be 9 to 18 digits"),
  ifsc: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC must be in format AAAA0XXXXXX"),
});

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
    accountNumber: body?.accountNumber,
  };

  const parsed = payoutBodySchema.safeParse(normalizedBody);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      {
        error: "Validation failed",
        details: fieldErrors,
        fieldErrors,
        errors: fieldErrors,
      },
      { status: 400 }
    );
  }

  const { name, email, mobile, pan, accountNumber, ifsc } = parsed.data;

  const supabase = await createClient();

  const { data: partnerProfile, error: partnerError } = await supabase
    .from("partner_profiles")
    .select("user_id, razorpay_account_id, razorpay_account_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (partnerError || !partnerProfile) {
    return NextResponse.json(
      { error: "Only student partners can set up payouts" },
      { status: 403 }
    );
  }

  if (partnerProfile.razorpay_account_id) {
    return NextResponse.json(
      { error: "Payout account already set up" },
      { status: 409 }
    );
  }

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error(
      "Missing Razorpay credentials: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required"
    );
  }

  const authHeader = `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64")}`;

  const razorpayResponse = await fetch("https://api.razorpay.com/v2/accounts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      email,
      phone: mobile,
      type: "route",
      legal_business_name: name,
      business_type: "individual",
      contact_name: name,
      profile: {
        category: "education",
        subcategory: "other",
      },
      legal_info: {
        pan,
      },
      bank_account: {
        ifsc_code: ifsc,
        beneficiary_name: name,
        account_number: accountNumber,
      },
    }),
  });

  if (!razorpayResponse.ok) {
    let errorMessage = "Razorpay account creation failed";
    try {
      const errData = await razorpayResponse.json();
      if (typeof errData?.error?.description === "string" && errData.error.description.trim()) {
        errorMessage = errData.error.description.trim();
      } else if (typeof errData?.error?.message === "string" && errData.error.message.trim()) {
        errorMessage = errData.error.message.trim();
      } else if (typeof errData?.message === "string" && errData.message.trim()) {
        errorMessage = errData.message.trim();
      } else if (typeof errData?.error === "string" && errData.error.trim()) {
        errorMessage = errData.error.trim();
      }
    } catch {
      // Body not JSON
    }

    if (accountNumber && errorMessage.includes(accountNumber)) {
      errorMessage = errorMessage.replaceAll(accountNumber, "[REDACTED]");
    }
    if (pan && errorMessage.includes(pan)) {
      errorMessage = errorMessage.replaceAll(pan, "[REDACTED]");
    }
    if (ifsc && errorMessage.includes(ifsc)) {
      errorMessage = errorMessage.replaceAll(ifsc, "[REDACTED]");
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 502 }
    );
  }

  const accountData = await razorpayResponse.json();
  const razorpayAccountId = accountData.id;
  const razorpayAccountStatus = accountData.status || "created";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

  const { error: updateError } = await adminClient
    .from("partner_profiles")
    .update({
      razorpay_account_id: razorpayAccountId,
      razorpay_account_status: razorpayAccountStatus,
    })
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to update partner profile" },
      { status: 500 }
    );
  }

  if (/^[6-9][0-9]{9}$/.test(mobile)) {
    const { error: profilePhoneError } = await adminClient
      .from("profiles")
      .update({ phone: mobile })
      .eq("id", user.id);

    if (profilePhoneError) {
      console.warn("Failed to update profile phone:", profilePhoneError);
    }
  }

  return NextResponse.json(
    { ok: true, status: razorpayAccountStatus },
    { status: 200 }
  );
}
