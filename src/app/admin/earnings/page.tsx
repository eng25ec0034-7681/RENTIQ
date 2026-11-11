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
  platform_fee: number;
}

export default function AdminEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayRows, setTodayRows] = useState<EarningsRow[]>([]);
  const [weekRows, setWeekRows] = useState<EarningsRow[]>([]);

  const loadEarnings = useCallback(async () => {
    setError(null);
    try {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
      const [year, month, day] = today.split("-").map(Number);
      const weekStartDate = new Date(Date.UTC(year, month - 1, day - 6));
      const weekStart = weekStartDate.toISOString().slice(0, 10);

      const [todayRes, weekRes] = await Promise.all([
        supabase.rpc("admin_platform_earnings", { p_from: today, p_to: today }),
        supabase.rpc("admin_platform_earnings", { p_from: weekStart, p_to: today }),
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
      const msg = err instanceof Error ? err.message : "Failed to load platform earnings.";
      setError(msg);
    }
  }, []);

  const checkAdminAndLoad = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "super_admin"]);

      if (error || !roles || roles.length === 0) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await loadEarnings();
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [loadEarnings]);

  useEffect(() => {
    checkAdminAndLoad();
  }, [checkAdminAndLoad]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEarnings();
    setRefreshing(false);
  };

  const safeAreaStyle = {
    paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))",
    paddingBottom: "calc(8rem + env(safe-area-inset-bottom, 0px))",
    paddingLeft: "calc(1rem + env(safe-area-inset-left, 0px))",
    paddingRight: "calc(1rem + env(safe-area-inset-right, 0px))",
  };

  if (loading) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center min-h-[50vh] px-4 text-base"
        style={safeAreaStyle}
      >
        <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-3" />
        <p className="text-base text-slate-400">Loading platform earnings...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center min-h-[50vh] px-4 text-base"
        style={safeAreaStyle}
      >
        <p className="text-base font-semibold text-red-400">Admins only.</p>
      </div>
    );
  }

  const todayJobs = todayRows.reduce((sum, r) => sum + (Number(r.jobs) || 0), 0);
  const todayPartnerEarnings = todayRows.reduce((sum, r) => sum + (Number(r.partner_earnings) || 0), 0);
  const todayPlatformFee = todayRows.reduce((sum, r) => sum + (Number(r.platform_fee) || 0), 0);

  const weekJobs = weekRows.reduce((sum, r) => sum + (Number(r.jobs) || 0), 0);
  const weekPartnerEarnings = weekRows.reduce((sum, r) => sum + (Number(r.partner_earnings) || 0), 0);
  const weekPlatformFee = weekRows.reduce((sum, r) => sum + (Number(r.platform_fee) || 0), 0);

  return (
    <div
      className="flex-1 flex flex-col px-4 py-6 max-w-4xl mx-auto w-full text-base text-slate-300"
      style={safeAreaStyle}
    >
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/admin/partners"
          className="inline-flex items-center gap-2 text-base font-semibold text-slate-400 hover:text-white transition min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Partners</span>
        </Link>
      </div>

      {/* Header and Refresh button */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <header>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Platform Earnings
          </h1>
        </header>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition disabled:opacity-50 text-base"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-base flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Two summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Today Card */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
          <h2 className="text-base font-bold text-white">Today</h2>
          <div className="space-y-1 text-base">
            <div className="text-slate-300">
              <span className="text-slate-400">Jobs count: </span>
              <span className="font-semibold text-white">{todayJobs}</span>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400">Partner earnings: </span>
              <span className="font-semibold text-emerald-400">₹{todayPartnerEarnings}</span>
            </div>
          </div>
        </div>

        {/* This Week Card */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-3">
          <h2 className="text-base font-bold text-white">This week</h2>
          <div className="space-y-1 text-base">
            <div className="text-slate-300">
              <span className="text-slate-400">Jobs count: </span>
              <span className="font-semibold text-white">{weekJobs}</span>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400">Partner earnings: </span>
              <span className="font-semibold text-emerald-400">₹{weekPartnerEarnings}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Day-by-day table */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white">Daily Breakdown (Last 7 Days)</h2>

        <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900">
          <table className="w-full text-base text-left text-slate-300">
            <thead className="bg-slate-800/60 text-white font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Jobs</th>
                <th className="py-3 px-4">Partner Earnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {weekRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 px-4 text-center text-slate-400">
                    No completed jobs in the last 7 days.
                  </td>
                </tr>
              ) : (
                weekRows.map((row) => (
                  <tr key={row.day} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-medium text-white">{row.day}</td>
                    <td className="py-3 px-4">{row.jobs}</td>
                    <td className="py-3 px-4 text-emerald-400 font-semibold">₹{row.partner_earnings}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
