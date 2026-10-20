"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { partnerZonesSchema } from "@/lib/validation/contactSchema";

export function PartnerZones() {
  const [zonesInput, setZonesInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadPartnerZones() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error: fetchErr } = await supabase
          .from("partner_profiles")
          .select("zones")
          .eq("user_id", user.id)
          .maybeSingle();

        if (fetchErr) {
          console.error("Error loading partner zones:", fetchErr);
        } else if (data?.zones && Array.isArray(data.zones)) {
          setZonesInput(data.zones.join(", "));
        }
      } catch (err) {
        console.error("Failed to fetch partner profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPartnerZones();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Parse comma-separated zones
    const parsedZones = zonesInput
      .split(",")
      .map((z) => z.trim())
      .filter((z) => z.length > 0);

    // Validate client-side with schema
    const validation = partnerZonesSchema.safeParse(parsedZones);
    if (!validation.success) {
      const msg = validation.error.errors[0]?.message || "Invalid zones format";
      setError(msg);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to update partner zones.");
      }

      // Check if partner profile exists
      const { data: existing } = await supabase
        .from("partner_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      let updateErr;
      if (existing) {
        // Save to partner_profiles.zones through Supabase client using signed-in user
        // Do not change is_approved, is_online or radius_km
        const { error } = await supabase
          .from("partner_profiles")
          .update({ zones: validation.data })
          .eq("user_id", user.id);
        updateErr = error;
      } else {
        const { error } = await supabase
          .from("partner_profiles")
          .insert({ user_id: user.id, zones: validation.data });
        updateErr = error;
      }

      if (updateErr) {
        throw new Error(updateErr.message || "Failed to save partner zones");
      }

      setSuccess("Partner zones updated successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving zones";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-brand-teal">
          <MapPin className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Partner Delivery Zones</h3>
          <p className="text-xs text-slate-400">
            Specify comma-separated zones you service for print & rental deliveries
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-brand-teal animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Service Zones (Comma-separated)
            </label>
            <input
              type="text"
              value={zonesInput}
              onChange={(e) => setZonesInput(e.target.value)}
              placeholder="e.g. Hostel 1, Central Library, North Block"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal min-h-[44px]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Up to 10 zones, 2–60 characters each.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-4 rounded-xl bg-brand-teal text-slate-950 font-bold text-xs hover:bg-brand-teal-light transition min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Zones...
              </>
            ) : (
              "Save Delivery Zones"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
