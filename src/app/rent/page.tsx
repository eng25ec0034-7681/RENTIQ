import Link from "next/link";
import { Search } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import Sticker from "@/components/Sticker";
import { createServerClient } from "@/lib/supabase/server";

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "₹ low to high" },
  { key: "price_desc", label: "₹ high to low" },
];

export default async function RentPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const active = SORTS.some((s) => s.key === sort) ? (sort as string) : "newest";

  const supabase = await createServerClient();
  let query = supabase
    .from("listings")
    .select("*, listing_photos(storage_path, position)")
    .eq("status", "ACTIVE")
    .limit(40);

  query =
    active === "price_asc"
      ? query.order("price_per_day", { ascending: true })
      : active === "price_desc"
      ? query.order("price_per_day", { ascending: false })
      : query.order("created_at", { ascending: false });

  const { data: listings } = await query;

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
        className="mb-4 flex items-center gap-2 w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-base min-h-[44px]"
      >
        <Search className="w-5 h-5" />
        Search by name or category
      </Link>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={`/rent?sort=${s.key}`}
            className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium border transition min-h-[40px] ${
              active === s.key
                ? "bg-brand-teal text-slate-950 border-brand-teal"
                : "bg-slate-900 text-slate-300 border-slate-800"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {listings && listings.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {listings.map((l: any) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
          <Sticker kind="book-stack" className="w-24 h-24 mx-auto mb-2" />
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
