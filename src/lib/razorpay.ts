import crypto from "node:crypto";

export function razorpayAuthHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Missing Razorpay credentials (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET)");
  }

  const credentials = `${keyId}:${keySecret}`;
  const base64 = Buffer.from(credentials).toString("base64");
  return `Basic ${base64}`;
}

async function handleRazorpayResponse(response: Response, action: string) {
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Razorpay ${action} failed: HTTP ${response.status}`);
  }

  if (!response.ok) {
    const errorDescription = data?.error?.description;
    if (errorDescription) {
      throw new Error(`Razorpay error: ${errorDescription}`);
    }
    throw new Error(`Razorpay ${action} failed with status ${response.status}`);
  }

  return data;
}

export async function createRazorpayOrder(
  amountPaise: number,
  receipt: string,
  notes: Record<string, string>
) {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: razorpayAuthHeader(),
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes,
    }),
  });

  return handleRazorpayResponse(response, "createOrder");
}

export async function fetchPayment(paymentId: string) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: {
      Authorization: razorpayAuthHeader(),
    },
  });

  return handleRazorpayResponse(response, "fetchPayment");
}

export async function createTransfer(args: {
  paymentId: string;
  accountId: string;
  amountPaise: number;
  notes?: Record<string, string>;
}) {
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(args.paymentId)}/transfers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: razorpayAuthHeader(),
      },
      body: JSON.stringify({
        transfers: [
          {
            account: args.accountId,
            amount: args.amountPaise,
            currency: "INR",
            notes: args.notes ?? {},
          },
        ],
      }),
    }
  );

  return handleRazorpayResponse(response, "createTransfer");
}

export async function reverseTransfer(transferId: string, amountPaise: number) {
  const response = await fetch(
    `https://api.razorpay.com/v1/transfers/${encodeURIComponent(transferId)}/reverse`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: razorpayAuthHeader(),
      },
      body: JSON.stringify({
        amount: amountPaise,
      }),
    }
  );

  return handleRazorpayResponse(response, "reverseTransfer");
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing RAZORPAY_WEBHOOK_SECRET");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}
