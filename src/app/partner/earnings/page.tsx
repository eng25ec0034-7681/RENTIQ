"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface EarningsRow {
  day: string;
  jobs: number;
  partner_earnings: number;
}

export default function PartnerEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayRows, setTodayRows] = useState<EarningsRow[]>([]);
  const [weekRows, setWeekRows] = useState<EarningsRow[]>([]);

  const loadEarnings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
      const [year, month, day] = today.split("-").map(Number);
      const weekStartDate = new Date(Date.UTC(year, month - 1, day - 6));
      const weekStart = weekStartDate.toISOString().slice(0, 10);

      const [todayRes, weekRes] = await Promise.all([
        supabase.rpc("get_my_earnings", { p_from: today, p_to: today }),
        supabase.rpc("get_my_earnings", { p_from: weekStart, p_to: today }),
      ]);

      const errorMsg = todayRes.error?.message || weekRes.error?.message;
      if (errorMsg) {
        setError(errorMsg);
      }

      if (todayRes.data && Array.isArray(todayRes.data)) {
        setTodayRows(todayRes.data as EarningsRow[]);
      } else if (!todayRes.error) {
        setTodayRows([]);
      }

      if (weekRes.data && Array.isArray(weekRes.data)) {
        setWeekRows(weekRes.data as EarningsRow[]);
      } else if (!weekRes.error) {
        setWeekRows([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load earnings.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEarnings();
  }, [loadEarnings]);

  const todayJobs = todayRows.reduce((sum, r) => sum + (Number(r.jobs) || 0), 0);
  const todayEarnings = todayRows.reduce((sum, r) => sum + (Number(r.partner_earnings) || 0), 0);

  const weekJobs = weekRows.reduce((sum, r) => sum + (Number(r.jobs) || 0), 0);
  const weekEarnings = weekRows.reduce((sum, r) => sum + (Number(r.partner_earnings) || 0), 0);

  return (
    <div
      className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full text-base text-slate-300"
      style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
    >
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/partner"
          className="inline-flex items-center gap-2 text-base font-semibold text-slate-400 hover:text-white transition min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Partner Dashboard</span>
        </Link>
      </div>

      {/* Header and Refresh button */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <header>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Partner Earnings
          </h1>
        </header>

        <button
          onClick={loadEarnings}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition disabled:opacity-50 text-base"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading state indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-base text-brand-teal mb-6">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading earnings...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-base flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Two summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Today Card */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <h2 className="text-base font-bold text-slate-400 mb-2">Today</h2>
          <div className="text-2xl font-black text-white mb-1">
            ₹{todayEarnings}
          </div>
          <div className="text-base text-slate-400">
            {todayJobs} {todayJobs === 1 ? "job" : "jobs"} completed
          </div>
        </div>

        {/* This Week Card */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <h2 className="text-base font-bold text-slate-400 mb-2">This week (last 7 days)</h2>
          <div className="text-2xl font-black text-white mb-1">
            ₹{weekEarnings}
          </div>
          <div className="text-base text-slate-400">
            {weekJobs} {weekJobs === 1 ? "job" : "jobs"} completed
          </div>
        </div>
      </div>

      {/* Day-by-day list */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white">Daily Breakdown</h2>

        {weekRows.length === 0 ? (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-base text-slate-400 text-center">
            No completed jobs in the last 7 days.
          </div>
        ) : (
          <div className="space-y-3">
            {weekRows.map((row) => (
              <div
                key={row.day}
                className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-base"
              >
                <div>
                  <div className="font-semibold text-white">{row.day}</div>
                  <div className="text-base text-slate-400">
                    {row.jobs} {row.jobs === 1 ? "job" : "jobs"}
                  </div>
                </div>
                <div className="text-base font-bold text-brand-teal text-right">
                  ₹{row.partner_earnings}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
