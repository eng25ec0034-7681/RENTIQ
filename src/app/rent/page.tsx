import Link from "next/link";
import { Search } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import { createServerClient } from "@/lib/supabase/server";

export default async function RentPage() {
  const supabase = await createServerClient();
  const { data: listings } = await supabase
    .from("listings")
    .select("*, listing_photos(storage_path, position)")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <div className="flex-1 flex flex-col px-4 py-6 max-w-3xl mx-auto w-full">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-white tracking-tight">Rent Something</h1>
        <p className="text-sm text-slate-400 mt-1">
          Everything students are lending on your campus right now.
        </p>
      </header>

      <Link
        href="/search"
        className="mb-6 flex items-center gap-2 w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-base min-h-[44px]"
      >
        <Search className="w-5 h-5" />
        Search by name or category
      </Link>

      {listings && listings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((l: any) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
          <p className="text-base font-medium text-slate-300">Nothing listed yet.</p>
          <p className="text-sm text-slate-500 mt-1">
            Be the first — list something you are willing to lend.
          </p>
          <Link
            href="/give"
            className="mt-4 inline-flex items-center justify-center px-4 py-2.5 bg-brand-teal text-slate-950 text-sm font-semibold rounded-xl min-h-[44px]"
          >
            List an item
          </Link>
        </div>
      )}
    </div>
  );
}
