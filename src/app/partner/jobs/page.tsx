"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  MapPin,
  Package,
  Printer,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface ActiveJob {
  kind: "PRINT" | "PARCEL";
  job_id: string;
  order_id: string;
  job_status: string;
  pickup_zone: string;
  drop_point: string | null;
  item_description: string | null;
  file_path: string | null;
  payment_status: string;
  total_amount: number;
  created_at: string;
}

interface StepInfo {
  label: string;
  nextStatus: string;
}

const PRINT_STEPS: Record<string, StepInfo> = {
  ACCEPTED: { label: "Reached shop", nextStatus: "AT_SHOP" },
  AT_SHOP: { label: "Start printing", nextStatus: "PRINTING" },
  PRINTING: { label: "Printing done", nextStatus: "PICKED_UP" },
  PICKED_UP: { label: "On the way", nextStatus: "IN_TRANSIT" },
  IN_TRANSIT: { label: "Arrived at drop point", nextStatus: "ARRIVED_AT_DROP" },
  ARRIVED_AT_DROP: { label: "Delivered", nextStatus: "DELIVERED" },
};

const PARCEL_STEPS: Record<string, StepInfo> = {
  ACCEPTED: { label: "Reached pickup point", nextStatus: "AT_SHOP" },
  AT_SHOP: { label: "Start pickup", nextStatus: "PRINTING" },
  PRINTING: { label: "Picked up", nextStatus: "PICKED_UP" },
  PICKED_UP: { label: "On the way", nextStatus: "IN_TRANSIT" },
  IN_TRANSIT: { label: "Arrived at drop point", nextStatus: "ARRIVED_AT_DROP" },
  ARRIVED_AT_DROP: { label: "Delivered", nextStatus: "DELIVERED" },
};

function formatStatusPlainWords(status: string, kind: "PRINT" | "PARCEL"): string {
  switch (status) {
    case "ACCEPTED":
      return "Accepted";
    case "AT_SHOP":
      return kind === "PRINT" ? "At shop" : "Reached pickup point";
    case "PRINTING":
      return kind === "PRINT" ? "Printing" : "Pickup in progress";
    case "PICKED_UP":
      return "Picked up";
    case "IN_TRANSIT":
      return "In transit";
    case "ARRIVED_AT_DROP":
      return "Arrived at drop point";
    case "DELIVERED":
      return "Delivered";
    default:
      return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export default function PartnerActiveJobsPage() {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [codes, setCodes] = useState<Record<string, string>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string | null>>({});
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);

  const loadJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    setPageError(null);
    try {
      const { data, error } = await supabase.rpc("get_my_active_jobs");

      if (error) {
        setPageError(error.message || "Failed to load active jobs.");
        return;
      }

      if (data && Array.isArray(data)) {
        setJobs(data as ActiveJob[]);
      } else {
        setJobs([]);
      }
    } catch (err: any) {
      setPageError(err?.message || "Failed to load active jobs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(() => {
      loadJobs();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const handleAdvance = async (job: ActiveJob, nextStatus: string) => {
    if (updatingJobId) return;
    setUpdatingJobId(job.job_id);
    setCardErrors((prev) => ({ ...prev, [job.job_id]: null }));

    try {
      const fnName = job.kind === "PRINT" ? "advance_print_job" : "advance_parcel_job";
      const { error } = await supabase.rpc(fnName, {
        p_job_id: job.job_id,
        p_next: nextStatus,
      });

      if (error) {
        setCardErrors((prev) => ({
          ...prev,
          [job.job_id]: error.message || "Failed to update job status.",
        }));
        await loadJobs();
      } else {
        setCardErrors((prev) => ({ ...prev, [job.job_id]: null }));
        await loadJobs();
      }
    } catch (err: any) {
      setCardErrors((prev) => ({
        ...prev,
        [job.job_id]: err?.message || "Failed to update job status.",
      }));
      await loadJobs();
    } finally {
      setUpdatingJobId(null);
    }
  };

  const handleComplete = async (job: ActiveJob) => {
    const code = codes[job.job_id]?.trim() || "";
    if (code.length !== 4 || updatingJobId) return;

    setUpdatingJobId(job.job_id);
    setCardErrors((prev) => ({ ...prev, [job.job_id]: null }));

    try {
      const { error } = await supabase.rpc("confirm_handover", {
        p_job_kind: job.kind,
        p_job_id: job.job_id,
        p_code: code,
      });

      if (error) {
        setCardErrors((prev) => ({
          ...prev,
          [job.job_id]: error.message || "Failed to complete job.",
        }));
        await loadJobs();
      } else {
        setCardErrors((prev) => ({ ...prev, [job.job_id]: null }));
        setCodes((prev) => {
          const next = { ...prev };
          delete next[job.job_id];
          return next;
        });
        await loadJobs();
      }
    } catch (err: any) {
      setCardErrors((prev) => ({
        ...prev,
        [job.job_id]: err?.message || "Failed to complete job.",
      }));
      await loadJobs();
    } finally {
      setUpdatingJobId(null);
    }
  };

  const handleOpenFile = async (jobId: string, filePath: string) => {
    setCardErrors((prev) => ({ ...prev, [jobId]: null }));
    const newTab = window.open("", "_blank");
    setOpeningFileId(jobId);
    try {
      const { data, error } = await supabase.storage
        .from("print-files")
        .createSignedUrl(filePath, 300);

      if (error || !data?.signedUrl) {
        newTab?.close();
        setCardErrors((prev) => ({
          ...prev,
          [jobId]: error?.message || "Failed to generate download link.",
        }));
        return;
      }

      if (newTab) {
        newTab.location.href = data.signedUrl;
      }
    } catch (err: any) {
      newTab?.close();
      setCardErrors((prev) => ({
        ...prev,
        [jobId]: err?.message || "Failed to open file.",
      }));
    } finally {
      setOpeningFileId(null);
    }
  };

  const handleCodeChange = (jobId: string, val: string) => {
    const digitsOnly = val.replace(/\D/g, "").slice(0, 4);
    setCodes((prev) => ({ ...prev, [jobId]: digitsOnly }));
  };

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
      <div className="mb-4">
        <Link
          href="/partner"
          className="text-base text-slate-400 hover:text-white inline-flex items-center gap-2 min-h-[44px] transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Partner Dashboard</span>
        </Link>
      </div>

      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Active Jobs</h1>
          <p className="text-base text-slate-400 mt-1">
            Track and advance your active deliveries.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadJobs(true)}
          disabled={loading || refreshing}
          className="min-h-[44px] px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-base font-medium rounded-xl flex items-center gap-2 transition disabled:opacity-50"
          aria-label="Refresh active jobs"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin text-[#00E5B0]" : ""}`}
          />
          <span>Refresh</span>
        </button>
      </header>

      {pageError && (
        <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-base text-rose-300">{pageError}</p>
        </div>
      )}

      {loading && jobs.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#00E5B0] animate-spin mb-2" />
          <p className="text-base text-slate-400">Loading active jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
          <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-base font-medium text-slate-300">
            No active jobs right now.
          </p>
          <p className="text-base text-slate-500 mt-1">
            Accepted orders will appear here for progress tracking.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => {
            const isUpdating = updatingJobId === job.job_id;
            const isOpening = openingFileId === job.job_id;
            const cardError = cardErrors[job.job_id];

            const stepMap = job.kind === "PRINT" ? PRINT_STEPS : PARCEL_STEPS;
            const currentStep = stepMap[job.job_status];
            const isDelivered = job.job_status === "DELIVERED";
            const codeInput = codes[job.job_id] || "";

            return (
              <div
                key={job.job_id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 shadow-lg"
              >
                {/* Header: Kind Badge & Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {job.kind === "PRINT" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-base font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        <Printer className="w-4 h-4" />
                        Print
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-base font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Package className="w-4 h-4" />
                        Parcel
                      </span>
                    )}
                  </div>

                  <span className="text-base font-medium px-3 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                    {formatStatusPlainWords(job.job_status, job.kind)}
                  </span>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-2 pt-1 text-base">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-5 h-5 text-[#00E5B0] shrink-0 mt-0.5" />
                    <div className="text-base text-white">
                      <span className="text-slate-400">Pickup zone: </span>
                      <span className="font-medium text-white">{job.pickup_zone}</span>
                    </div>
                  </div>

                  {job.kind === "PARCEL" && job.drop_point && (
                    <div className="text-base text-white pl-7">
                      <span className="text-slate-400">Drop point: </span>
                      <span className="font-medium text-white">{job.drop_point}</span>
                    </div>
                  )}

                  {job.kind === "PARCEL" && job.item_description && (
                    <div className="text-base text-white pl-7">
                      <span className="text-slate-400">Item description: </span>
                      <span className="font-medium text-white">{job.item_description}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pl-7 pt-1 border-t border-slate-800/80">
                    <div className="text-base text-slate-300">
                      Total: <span className="font-bold text-white">₹{job.total_amount}</span>
                    </div>
                    <div className="text-base text-slate-300">Payment: {job.payment_status}</div>
                  </div>
                </div>

                {/* Print Job Open File */}
                {job.kind === "PRINT" && job.file_path && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenFile(job.job_id, job.file_path!)}
                      disabled={isOpening}
                      className="min-h-[44px] w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-base font-semibold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {isOpening ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-[#00E5B0]" />
                          <span>Opening file...</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-5 h-5" />
                          <span>Open file</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Card Error Display */}
                {cardError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2 mt-1">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-base text-rose-300">{cardError}</p>
                  </div>
                )}

                {/* Action Buttons / Handover Code */}
                <div className="pt-2">
                  {isDelivered ? (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label
                          htmlFor={`code-${job.job_id}`}
                          className="block text-base font-medium text-slate-300 mb-2"
                        >
                          Enter the 4-digit code from the customer
                        </label>
                        <input
                          id={`code-${job.job_id}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          value={codeInput}
                          onChange={(e) => handleCodeChange(job.job_id, e.target.value)}
                          placeholder="0000"
                          disabled={isUpdating}
                          className="w-full text-base bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white tracking-widest text-center focus:outline-none focus:border-[#00E5B0] min-h-[44px] font-mono"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleComplete(job)}
                        disabled={codeInput.length !== 4 || isUpdating}
                        className="w-full min-h-[44px] px-4 py-2.5 bg-[#00E5B0] hover:bg-[#00c99a] text-slate-950 text-base font-semibold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <span>Complete job</span>
                        )}
                      </button>
                    </div>
                  ) : currentStep ? (
                    <button
                      type="button"
                      onClick={() => handleAdvance(job, currentStep.nextStatus)}
                      disabled={isUpdating}
                      className="w-full min-h-[44px] px-4 py-2.5 bg-[#00E5B0] hover:bg-[#00c99a] text-slate-950 text-base font-semibold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <span>{currentStep.label}</span>
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
