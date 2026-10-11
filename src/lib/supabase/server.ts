import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-rentiq.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        } catch {
          // Called from Server Component context - safe to ignore
        }
      },
    },
  });
}

// --------------------
// Helper to fetch the current authenticated user (or throw)
// No extra import needed – getUserOrThrow uses createClient defined above

export async function getUserOrThrow() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    throw new Error("User not authenticated");
  }
  return data.user;
}

export const createServerClient = createClient;
