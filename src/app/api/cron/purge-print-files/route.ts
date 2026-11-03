import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel Cron route — runs server-side only, protected by CRON_SECRET
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Service-role client for cron job only — never exposed to browser
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase.rpc("purge_expired_print_files");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data as Array<{ file_path?: string | null }> | null) ?? [];
  const paths: string[] = [];
  for (const row of rows) {
    if (typeof row === "string" && row.length > 0) {
      paths.push(row);
    } else if (
      row &&
      typeof row === "object" &&
      typeof row.file_path === "string" &&
      row.file_path.length > 0
    ) {
      paths.push(row.file_path);
    }
  }

  if (paths.length === 0) {
    return NextResponse.json({ removed: 0 });
  }

  const CHUNK_SIZE = 100;
  let removed = 0;
  let errors = 0;

  for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
    const chunk = paths.slice(i, i + CHUNK_SIZE);
    const { error: storageError } = await supabase.storage
      .from("print-files")
      .remove(chunk);

    if (storageError) {
      errors++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("print_orders")
      .update({ file_path: null })
      .in("file_path", chunk);

    if (updateError) {
      errors++;
      continue;
    }

    removed += chunk.length;
  }

  return NextResponse.json({ removed, errors });
}
