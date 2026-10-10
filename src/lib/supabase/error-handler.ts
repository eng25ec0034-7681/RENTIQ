import { NextResponse } from "next/server";

export function handleSupabaseError(err: unknown) {
  const message = err instanceof Error ? err.message : "Internal server error";

  // Check for DNS or network fetch failures (e.g. placeholder URL or offline)
  if (
    message.includes("fetch failed") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED")
  ) {
    return NextResponse.json(
      {
        error:
          "Unable to connect to Supabase database. Please ensure your valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured in .env.local.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ error: message }, { status: 500 });
}
