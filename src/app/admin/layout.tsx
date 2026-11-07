import { redirect } from "next/navigation";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: { id: string } | null = null;
  try {
    user = await getUserOrThrow();
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: roleRow, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "super_admin"])
    .maybeSingle();

  if (error || !roleRow) {
    redirect("/");
  }

  return <div>{children}</div>;
}
