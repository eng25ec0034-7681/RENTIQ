"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import Sticker from "@/components/Sticker";
import ListingCard from "@/components/ListingCard";
import { createClient } from "@/lib/supabase/client";
import { listingCategories, listingConditions } from "@/lib/validation/listingSchema";
import type { Listing } from "@/types";

const PRICE_RANGES = [
  { label: "₹10-20", min: 10, max: 20 },
  { label: "₹21-50", min: 21, max: 50 },
  { label: "₹51-100", min: 51, max: 100 },
];

const CONDITION_LABELS: Record<string, string> = {
  LIKE_NEW: "Like new",
  GOOD: "Good",
  FAIR: "Fair",
  HEAVILY_USED: "Heavily used",
};

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

// PostgREST's .or() filter splits on , and ( ), and ilike treats % and * as wildcards.
// Anything the user types has to be stripped before it reaches the query string.
function sanitize(input: string) {
  return input.replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim();
}

function SearchInner() {
  const params = useSearchParams();
  const initialQuery = params.get("q") ?? "";

  const [text, setText] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<number | null>(null);
  const [condition, setCondition] = useState<string | null>(null);
  const [sort, setSort] = useState<SortValue>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  // Debounce typing so every keystroke is not a database round trip.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(text), 300);
    return () => clearTimeout(id);
  }, [text]);

  // Keep the URL shareable without triggering a Next.js navigation.
  useEffect(() => {
    const q = debounced.trim();
    const url = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
    window.history.replaceState(null, "", url);
  }, [debounced]);

  const runSearch = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      let query = supabase
        .from("listings")
        .select("*, listing_photos(storage_path, position)")
        .eq("status", "ACTIVE")
        .limit(40);

      const safe = sanitize(debounced);
      if (safe) {
        query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
      }
      if (category) query = query.eq("category", category);
      if (condition) query = query.eq("condition", condition);
      if (priceRange !== null) {
        const range = PRICE_RANGES[priceRange];
        query = query.gte("price_per_day", range.min).lte("price_per_day", range.max);
      }

      query =
        sort === "price_asc"
          ? query.order("price_per_day", { ascending: true })
          : sort === "price_desc"
          ? query.order("price_per_day", { ascending: false })
          : query.order("created_at", { ascending: false });

      const { data, error: queryError } = await query;
      if (id !== requestId.current) return; // a newer search already started

      if (queryError) {
        setError(queryError.message || "Search failed. Try again.");
        setResults([]);
      } else {
        setResults((data ?? []) as unknown as Listing[]);
      }
    } catch (err: any) {
      if (id !== requestId.current) return;
      setError(err?.message || "Search failed. Try again.");
      setResults([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [debounced, category, condition, priceRange, sort]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const hasFilters = Boolean(
    debounced.trim() || category || condition || priceRange !== null || sort !== "newest"
  );

  const clearAll = () => {
    setText("");
    setDebounced("");
    setCategory(null);
    setCondition(null);
    setPriceRange(null);
    setSort("newest");
  };

  const heading = useMemo(() => {
    if (!hasFilters) return "Browse all listings";
    return loading
      ? "Searching..."
      : `${results.length} ${results.length === 1 ? "result" : "results"}`;
  }, [hasFilters, loading, results.length]);

  return (
    <div className="flex-1 flex flex-col px-4 py-6 max-w-3xl mx-auto w-full">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-white tracking-tight">Search</h1>
        <p className="text-sm text-slate-400 mt-1">
          Find books, calculators, gear and more on your campus.
        </p>
      </header>

      {/* Search box */}
      <div className="relative mb-3">
        <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
        <input
          type="search"
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          placeholder="What do you need?"
          aria-label="Search listings"
          className="w-full pl-12 pr-12 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white text-base placeholder-slate-400 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px]"
        />
        {text ? (
          <button
            type="button"
            onClick={() => setText("")}
            aria-label="Clear search"
            className="absolute right-3 top-2.5 p-1.5 text-slate-400 hover:text-white min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-4 px-4">
        {listingCategories.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(active ? null : cat)}
              aria-pressed={active}
              className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium border transition min-h-[40px] capitalize ${
                active
                  ? "bg-brand-teal text-slate-950 border-brand-teal"
                  : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Filter toggle + sort */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-sm font-medium min-h-[40px]"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortValue)}
          aria-label="Sort results"
          className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-sm font-medium min-h-[40px]"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-sm font-medium text-brand-teal min-h-[40px] px-2"
          >
            Clear
          </button>
        )}
      </div>

      {showFilters && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Price per day
            </p>
            <div className="flex flex-wrap gap-2">
              {PRICE_RANGES.map((range, i) => {
                const active = priceRange === i;
                return (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() => setPriceRange(active ? null : i)}
                    aria-pressed={active}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition min-h-[40px] ${
                      active
                        ? "bg-brand-teal text-slate-950 border-brand-teal"
                        : "bg-slate-800 text-slate-300 border-slate-800"
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Condition
            </p>
            <div className="flex flex-wrap gap-2">
              {listingConditions.map((c) => {
                const active = condition === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCondition(active ? null : c)}
                    aria-pressed={active}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition min-h-[40px] ${
                      active
                        ? "bg-brand-teal text-slate-950 border-brand-teal"
                        : "bg-slate-800 text-slate-300 border-slate-800"
                    }`}
                  >
                    {CONDITION_LABELS[c] ?? c}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {heading}
        </h2>
        {loading && <Loader2 className="w-4 h-4 text-brand-teal animate-spin" />}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 mb-4">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {loading && results.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-56 rounded-lg bg-slate-900 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : results.length === 0 && !error ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
          <Sticker kind="search" className="w-20 h-20 mx-auto mb-3" />
          <p className="text-base font-medium text-slate-300">Nothing matched that search.</p>
          <p className="text-sm text-slate-500 mt-1">
            Try a shorter word, or clear the filters to see everything.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-4 inline-flex items-center justify-center px-4 py-2.5 bg-brand-teal text-slate-950 text-sm font-semibold rounded-xl min-h-[44px]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {results.length >= 40 && (
        <p className="text-center text-sm text-slate-500 mt-6">
          Showing the first 40 matches. Add a filter to narrow it down.
        </p>
      )}

      <div className="mt-8 flex items-center justify-center gap-4 text-sm">
        <Link href="/print" className="text-brand-teal font-medium">
          Print / Xerox
        </Link>
        <span className="text-slate-700"></span>
        <Link href="/delivery" className="text-brand-teal font-medium">
          Get delivery
        </Link>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-6 h-6 text-brand-teal animate-spin" />
        </div>
      }
    >
      <SearchInner />
    </Suspense>
  );
}
