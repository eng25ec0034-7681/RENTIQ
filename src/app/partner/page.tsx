"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, RefreshCw, AlertCircle, Clock, MapPin, Package, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface PartnerProfile {
  user_id: string;
  is_approved: boolean;
  is_online: boolean;
  radius_km?: number;
  zones?: string[];
}

interface OfferItem {
  id: string; // job_id
  type: "Print" | "Parcel";
  jobId: string;
  pickupZone: string;
  createdAt: string;
}

export default function PartnerPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [noProfile, setNoProfile] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const alertsEnabledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const seenOfferIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const alarmsRef = useRef<Map<string, { intervalId: NodeJS.Timeout; timeoutId: NodeJS.Timeout }>>(
    new Map()
  );
  const activeOscillatorsRef = useRef<Set<OscillatorNode>>(new Set());

  const [workingOfferId, setWorkingOfferId] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState<"accept" | "reject" | null>(null);
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  const playBeep = useCallback(() => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx || ctx.state === "closed") return;
      if (typeof ctx.resume === "function" && ctx.state === "suspended") {
        ctx.resume();
      }
      if (typeof ctx.createOscillator === "function" && typeof ctx.createGain === "function") {
        const notes = [
          { freq: 784, start: ctx.currentTime, duration: 0.12 },
          { freq: 988, start: ctx.currentTime + 0.13, duration: 0.12 },
          { freq: 1319, start: ctx.currentTime + 0.26, duration: 0.25 },
        ];

        notes.forEach(({ freq, start, duration }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          if (osc.frequency && typeof osc.frequency.setValueAtTime === "function") {
            osc.frequency.setValueAtTime(freq, start);
          } else if (osc.frequency) {
            osc.frequency.value = freq;
          }

          const end = start + duration;
          if (gain.gain && typeof gain.gain.setValueAtTime === "function") {
            gain.gain.setValueAtTime(0.2, start);
            if (typeof gain.gain.exponentialRampToValueAtTime === "function") {
              gain.gain.exponentialRampToValueAtTime(0.0001, end);
            }
          }

          osc.connect(gain);
          if (ctx.destination) {
            gain.connect(ctx.destination);
          }
          if (typeof osc.start === "function") {
            osc.start(start);
          }
          if (typeof osc.stop === "function") {
            osc.stop(end);
          }

          activeOscillatorsRef.current.add(osc);
          osc.onended = () => {
            activeOscillatorsRef.current.delete(osc);
          };
        });
      }

      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch {
          // ignore error if vibrate not permitted or unsupported
        }
      }
    } catch {
      // AudioContext error handling
    }
  }, []);

  const stopAlert = useCallback((id: string) => {
    const alarm = alarmsRef.current.get(id);
    if (alarm) {
      clearInterval(alarm.intervalId);
      clearTimeout(alarm.timeoutId);
      alarmsRef.current.delete(id);
    }
  }, []);

  const startAlert = useCallback(
    (id: string) => {
      stopAlert(id);
      playBeep();
      const intervalId = setInterval(() => {
        playBeep();
      }, 1000);
      const timeoutId = setTimeout(() => {
        stopAlert(id);
      }, 60000);
      alarmsRef.current.set(id, { intervalId, timeoutId });
    },
    [playBeep, stopAlert]
  );

  useEffect(() => {
    return () => {
      alarmsRef.current.forEach((alarm) => {
        clearInterval(alarm.intervalId);
        clearTimeout(alarm.timeoutId);
      });
      alarmsRef.current.clear();

      activeOscillatorsRef.current.forEach((osc) => {
        try {
          if (typeof osc.stop === "function") osc.stop();
          if (typeof osc.disconnect === "function") osc.disconnect();
        } catch {}
      });
      activeOscillatorsRef.current.clear();

      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          if (typeof audioContextRef.current.close === "function") {
            audioContextRef.current.close();
          }
        } catch {}
      }
    };
  }, []);

  const handleEnableAlerts = () => {
    try {
      const AudioContextClass =
        typeof window !== "undefined"
          ? window.AudioContext || (window as any).webkitAudioContext
          : null;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (typeof ctx.resume === "function" && ctx.state === "suspended") {
          ctx.resume();
        }
        audioContextRef.current = ctx;
      }
    } catch {
      // ignore
    }
    setAlertsEnabled(true);
    alertsEnabledRef.current = true;
  };

  // Load partner profile
  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setNoProfile(true);
        return;
      }

      const { data, error } = await supabase
        .from("partner_profiles")
        .select("user_id, is_approved, is_online, radius_km, zones")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        setNoProfile(true);
        return;
      }

      setProfile(data as PartnerProfile);
      setNoProfile(false);
    } catch {
      setNoProfile(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load offers (Print and Parcel where status is OFFERED)
  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    setRefreshError(null);
    try {
      const { data, error } = await supabase.rpc("list_partner_offers");

      if (error) {
        setRefreshError(error.message || "Failed to refresh offers.");
        return;
      }

      if (data && Array.isArray(data)) {
        const items: OfferItem[] = data.map((row: any) => ({
          id: row.job_id,
          type: row.offer_type === "Print" ? "Print" : "Parcel",
          jobId: row.job_id,
          pickupZone: row.pickup_zone,
          createdAt: row.created_at,
        }));

        if (isInitialLoadRef.current) {
          items.forEach((item) => seenOfferIdsRef.current.add(item.id));
          isInitialLoadRef.current = false;
        } else {
          items.forEach((item) => {
            if (!seenOfferIdsRef.current.has(item.id)) {
              seenOfferIdsRef.current.add(item.id);
              if (alertsEnabledRef.current) {
                startAlert(item.id);
              }
            }
          });
        }

        setOffers(items);
      } else {
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        }
        setOffers([]);
      }
    } catch {
      setRefreshError("Failed to refresh offers.");
    } finally {
      setOffersLoading(false);
    }
  }, [startAlert]);

  // Initial load
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // When profile is loaded and approved, load offers & set 10s interval
  useEffect(() => {
    if (profile) {
      loadOffers();
      const interval = setInterval(() => {
        loadOffers();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [profile, loadOffers]);

  // Duty toggle change handler
  const handleToggleDuty = async (nextOnline: boolean) => {
    if (!profile || !profile.is_approved || toggling) return;

    setToggling(true);
    setToggleError(null);

    try {
      const { data, error } = await supabase
        .from("partner_profiles")
        .update({ is_online: nextOnline })
        .eq("user_id", profile.user_id)
        .select()
        .single();

      if (error) {
        setToggleError(error.message || "Failed to update duty status.");
      } else if (data) {
        setProfile((prev) => (prev ? { ...prev, is_online: data.is_online } : null));
      }
    } catch (err: any) {
      setToggleError(err?.message || "Failed to update duty status.");
    } finally {
      setToggling(false);
    }
  };

  const handleAccept = async (offer: OfferItem) => {
    if (workingOfferId) return;
    stopAlert(offer.id);
    setWorkingOfferId(offer.id);
    setWorkingAction("accept");
    setOfferErrors((prev) => {
      const next = { ...prev };
      delete next[offer.id];
      return next;
    });

    try {
      const fnName = offer.type === "Print" ? "accept_print_job" : "accept_parcel_job";
      const { error } = await supabase.rpc(fnName, { p_job_id: offer.jobId });

      if (error) {
        setOfferErrors((prev) => ({
          ...prev,
          [offer.id]: error.message || "Failed to accept job",
        }));
        await loadOffers();
      } else {
        setOffers((prev) => prev.filter((o) => o.id !== offer.id));
        await loadOffers();
      }
    } catch (err: any) {
      setOfferErrors((prev) => ({
        ...prev,
        [offer.id]: err?.message || "Failed to accept job",
      }));
      await loadOffers();
    } finally {
      setWorkingOfferId(null);
      setWorkingAction(null);
    }
  };

  const handleReject = async (offer: OfferItem) => {
    if (workingOfferId) return;
    stopAlert(offer.id);
    setWorkingOfferId(offer.id);
    setWorkingAction("reject");
    setOfferErrors((prev) => {
      const next = { ...prev };
      delete next[offer.id];
      return next;
    });

    try {
      const fnName = offer.type === "Print" ? "reject_print_job" : "reject_parcel_job";
      const { error } = await supabase.rpc(fnName, { p_job_id: offer.jobId });

      if (error) {
        setOfferErrors((prev) => ({
          ...prev,
          [offer.id]: error.message || "Failed to reject job",
        }));
        await loadOffers();
      } else {
        setOffers((prev) => prev.filter((o) => o.id !== offer.id));
        await loadOffers();
      }
    } catch (err: any) {
      setOfferErrors((prev) => ({
        ...prev,
        [offer.id]: err?.message || "Failed to reject job",
      }));
      await loadOffers();
    } finally {
      setWorkingOfferId(null);
      setWorkingAction(null);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center min-h-[50vh] px-4"
        style={{
          paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))",
          paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
          paddingLeft: "calc(1rem + env(safe-area-inset-left, 0px))",
          paddingRight: "calc(1rem + env(safe-area-inset-right, 0px))",
        }}
      >
        <Loader2 className="w-8 h-8 text-[#00E5B0] animate-spin mb-2" />
        <p className="text-slate-400 text-base">Loading partner portal...</p>
      </div>
    );
  }

  if (noProfile || !profile) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center min-h-[50vh] px-4 text-center max-w-md mx-auto"
        style={{
          paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))",
          paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
          paddingLeft: "calc(1rem + env(safe-area-inset-left, 0px))",
          paddingRight: "calc(1rem + env(safe-area-inset-right, 0px))",
        }}
      >
        <AlertCircle className="w-12 h-12 text-amber-400 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Partner Access</h1>
        <p className="text-base text-slate-300">
          You are not registered as a student partner yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col px-4 py-6 max-w-xl mx-auto w-full"
      style={{
        paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))",
        paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
        paddingLeft: "calc(1rem + env(safe-area-inset-left, 0px))",
        paddingRight: "calc(1rem + env(safe-area-inset-right, 0px))",
      }}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Partner Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your duty status and view open delivery offers.
        </p>
      </header>

      {/* Account not approved banner */}
      {!profile.is_approved && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-medium text-amber-300">
              Your partner account is waiting for approval.
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Duty toggle will be unlocked once an admin reviews and approves your account.
            </p>
          </div>
        </div>
      )}

      {/* Duty toggle card */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-base font-semibold text-white block">On duty</span>
            <span className="text-sm text-slate-400">
              {profile.is_approved
                ? profile.is_online
                  ? "Available to receive delivery offers"
                  : "Offline – turn on to receive offers"
                : "Awaiting account approval"}
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              className="sr-only peer"
              disabled={!profile.is_approved || toggling}
              checked={profile.is_online}
              onChange={(e) => handleToggleDuty(e.target.checked)}
            />
            <div
              className={`w-14 h-8 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all ${
                profile.is_online ? "peer-checked:bg-[#00E5B0]" : ""
              } ${
                !profile.is_approved || toggling
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:opacity-90"
              }`}
            />
          </label>
        </div>

        {toggling && (
          <div className="flex items-center gap-2 mt-3 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-[#00E5B0]" />
            Updating status...
          </div>
        )}

        {toggleError && (
          <p className="text-sm text-rose-400 mt-3">{toggleError}</p>
        )}
      </section>

      {/* Open offers section */}
      <section className="flex-1 flex flex-col">
        {!alertsEnabled && (
          <div className="mb-4 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-slate-300">
              Tap Enable alerts to hear new offers.
            </p>
            <button
              type="button"
              onClick={handleEnableAlerts}
              className="min-h-[44px] px-4 py-2 bg-[#00E5B0] hover:bg-[#00c99a] text-slate-950 text-sm font-semibold rounded-xl shrink-0 transition"
            >
              Enable alerts
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Open Offers</h2>
            {offers.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#00E5B0]/20 text-[#00E5B0]">
                {offers.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={loadOffers}
            disabled={offersLoading}
            className="min-h-[44px] px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-sm font-medium rounded-xl flex items-center gap-2 transition disabled:opacity-50"
            aria-label="Refresh offers"
          >
            <RefreshCw
              className={`w-4 h-4 ${offersLoading ? "animate-spin text-[#00E5B0]" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>

        {refreshError && (
          <p className="text-sm text-rose-400 mb-3">{refreshError}</p>
        )}

        {offersLoading && offers.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#00E5B0] animate-spin mb-2" />
            <p className="text-sm text-slate-400">Checking for new offers...</p>
          </div>
        ) : offers.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
            <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-medium text-slate-300">
              No open offers right now.
            </p>
            <p className="text-sm text-slate-500 mt-1">
              New pickup offers will appear here automatically when available in your zones.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {offers.map((offer) => {
              const isWorking = workingOfferId === offer.id;
              return (
                <div
                  key={offer.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {offer.type === "Print" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          <Printer className="w-3.5 h-3.5" />
                          Print
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Package className="w-3.5 h-3.5" />
                          Parcel
                        </span>
                      )}
                      <span className="text-xs text-slate-500 font-mono">
                        #{offer.jobId.slice(0, 8)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatTime(offer.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="w-4 h-4 text-[#00E5B0] shrink-0" />
                    <span className="text-sm font-medium text-white truncate">
                      Pickup zone: <span className="text-slate-300">{offer.pickupZone}</span>
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 truncate mt-1">
                    Job ID: {offer.jobId}
                  </div>

                  {offerErrors[offer.id] && (
                    <p className="text-sm text-rose-400 mt-2">{offerErrors[offer.id]}</p>
                  )}

                  <div className="flex items-center gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => handleAccept(offer)}
                      disabled={isWorking}
                      className="flex-1 min-h-[44px] px-4 py-2.5 bg-[#00E5B0] hover:bg-[#00c99a] text-slate-950 text-base font-semibold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {isWorking && workingAction === "accept" ? "Working..." : "Accept"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(offer)}
                      disabled={isWorking}
                      className="flex-1 min-h-[44px] px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-base font-semibold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {isWorking && workingAction === "reject" ? "Working..." : "Reject"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
