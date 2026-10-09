import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-rentiq.supabase.co";
    const isPlaceholder = supabaseUrl.includes("placeholder");

    const response = NextResponse.json({ message: "Logged out successfully" });
    response.cookies.delete("rentiq_user_id");

    if (!isPlaceholder) {
      try {
        const supabase = await createClient();
        await supabase.auth.signOut();
      } catch {
        // Safe to ignore
      }
    }

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
