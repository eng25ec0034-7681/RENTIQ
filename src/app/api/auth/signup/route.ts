import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { devStore } from "@/lib/supabase/dev-store";

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-rentiq.supabase.co";
    const isPlaceholder = supabaseUrl.includes("placeholder");

    if (isPlaceholder) {
      const result = await devStore.signUp(email, password, name);
      const response = NextResponse.json(result);
      response.cookies.set("rentiq_user_id", result.user.id, {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return response;
    }

    try {
      const supabase: any = await createClient();
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
    } catch {
      // Fallback to dev store if network fetch to Supabase URL fails
      const result = await devStore.signUp(email, password, name);
      const response = NextResponse.json(result);
      response.cookies.set("rentiq_user_id", result.user.id, {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
