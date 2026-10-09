import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleSupabaseError } from "@/lib/supabase/error-handler";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateCheck = checkRateLimit(`signup:${ip}`, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again in 1 minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validation = signupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = validation.data;
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data.user, session: data.session });
  } catch (err: unknown) {
    return handleSupabaseError(err);
  }
}
