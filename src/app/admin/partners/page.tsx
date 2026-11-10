"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface Partner {
  user_id: string;
  is_approved: boolean;
  is_online: boolean;
  zones: string[] | null;
  created_at: string;
}

export default function AdminPartnersPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadPartners = useCallback(async () => {
    const { data, error } = await supabase
      .from("partner_profiles")
      .select("user_id, is_approved, is_online, zones, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPartners(data as Partner[]);
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
      await loadPartners();
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [loadPartners]);

  useEffect(() => {
    checkAdminAndLoad();
  }, [checkAdminAndLoad]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPartners();
    setRefreshing(false);
  };

  const handleToggleApproval = async (id: string, newApprovedStatus: boolean) => {
    setSavingUserId(id);
    setCardErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    const { error } = await supabase
      .from("partner_profiles")
      .update({ is_approved: newApprovedStatus })
      .eq("user_id", id);

    if (error) {
      setCardErrors((prev) => ({
        ...prev,
        [id]: error.message || "Failed to update partner approval status",
      }));
    }

    await loadPartners();
    setSavingUserId(null);
  };

  const safeAreaStyle = {
    paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))",
    paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
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
        <p className="text-base text-slate-400">Loading partners...</p>
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

  const waitingPartners = partners.filter((p) => !p.is_approved);
  const approvedPartners = partners.filter((p) => p.is_approved);

  const renderPartnerCard = (partner: Partner) => {
    const isSaving = savingUserId === partner.user_id;
    const shortId = partner.user_id.slice(0, 8);
    const zonesDisplay =
      partner.zones && partner.zones.length > 0 ? partner.zones.join(", ") : "No zones";
    const statusText = partner.is_online ? "Online" : "Offline";
    const errorMessage = cardErrors[partner.user_id];

    return (
      <div
        key={partner.user_id}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-base flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1 text-base">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-white">ID: {shortId}</span>
            <span
              className={`text-base font-medium ${
                partner.is_online ? "text-emerald-400" : "text-slate-400"
              }`}
            >
              {statusText}
            </span>
          </div>
          <div className="text-base text-slate-300">
            <span className="text-slate-400">Zones: </span>
            {zonesDisplay}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-base">
            {errorMessage}
          </div>
        )}

        <div className="pt-2">
          {partner.is_approved && (
            <button
              onClick={() => handleToggleApproval(partner.user_id, false)}
              disabled={isSaving}
              className="w-full min-h-[44px] h-[44px] px-4 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30 text-base font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? "Saving..." : "Pause"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex-1 flex flex-col px-4 py-6 max-w-xl mx-auto w-full text-base"
      style={safeAreaStyle}
    >
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Partner Management</h1>
          <p className="text-base text-slate-400 mt-1">Review and manage delivery partner approvals.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="min-h-[44px] h-[44px] px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 text-base font-semibold transition flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <Link
        href="/admin/earnings"
        className="inline-flex items-center justify-center min-h-[44px] h-[44px] px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 text-base font-semibold transition mb-6 w-fit"
      >
        Platform earnings
      </Link>

      {/* Waiting for approval section */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">
          Payout pending ({waitingPartners.length})
        </h2>
        {waitingPartners.length === 0 ? (
          <p className="text-base text-slate-400 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5">
            No partners waiting for approval.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {waitingPartners.map(renderPartnerCard)}
          </div>
        )}
      </section>

      {/* Approved section */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">
          Approved ({approvedPartners.length})
        </h2>
        {approvedPartners.length === 0 ? (
          <p className="text-base text-slate-400 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5">
            No approved partners yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {approvedPartners.map(renderPartnerCard)}
          </div>
        )}
      </section>
    </div>
  );
}
