"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  MessageSquare,
  ShieldCheck,
  Building,
  Upload,
  AlertTriangle,
  Loader2,
  XCircle,
  FileText,
  DollarSign,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Rental, RentalStatusEvent, RentalEvidence } from "@/types";

export default function OrderDetailPage() {
  const params = useParams();
  const rentalId = params.id as string;
  const router = useRouter();

  const [rental, setRental] = useState<Rental | null>(null);
  const [userRole, setUserRole] = useState<"renter" | "owner">("renter");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Evidence upload state
  const [showEvidenceModal, setShowEvidenceModal] = useState<"HANDOVER" | "RETURN" | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRentalDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/rentals/${rentalId}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load rental");
      }
      setRental(data.rental);
      setUserRole(data.userRole);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading rental";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rentalId) {
      fetchRentalDetail();
    }
  }, [rentalId]);

  const handleTransition = async (to_status: string, payment_status?: string, note?: string) => {
    if (!rental) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/rentals/${rental.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_status, payment_status, note }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      setSuccess(`Rental status updated to ${to_status.replace(/_/g, " ")}`);
      await fetchRentalDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transition failed";
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEvidenceModal || !rental) return;

    setUploadingEvidence(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("type", showEvidenceModal);
      if (evidenceNotes) formData.append("condition_notes", evidenceNotes);
      if (damageNotes) formData.append("damage_notes", damageNotes);
      evidenceFiles.forEach((file) => formData.append("photos", file));

      const res = await fetch(`/api/rentals/${rental.id}/evidence`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload evidence");
      }

      setSuccess("Evidence recorded successfully!");
      setShowEvidenceModal(null);
      setEvidenceFiles([]);
      setEvidenceNotes("");
      setDamageNotes("");
      await fetchRentalDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record evidence";
      setError(msg);
    } finally {
      setUploadingEvidence(false);
    }
  };

  const openChat = async () => {
    if (!rental) return;
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: rental.listing_id }),
      });
      const data = await res.json();
      if (data.conversation_id) {
        router.push(`/messages/${data.conversation_id}`);
      }
    } catch {
      router.push("/messages");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-2" />
        <p className="text-xs text-slate-400">Loading order details...</p>
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="flex-1 p-6 text-center">
        <p className="text-sm text-red-400 mb-4">{error || "Rental not found"}</p>
        <Link href="/orders" className="text-brand-teal text-xs font-semibold hover:underline min-h-[44px] min-w-[44px] inline-flex items-center justify-center">
          Return to Orders
        </Link>
      </div>
    );
  }

  const otherPerson = userRole === "renter" ? rental.owner : rental.renter;

  return (
    <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full pb-24">
      {/* Back button */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/orders"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition py-1 min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </Link>
        <button
          onClick={openChat}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-brand-teal text-xs font-bold rounded-xl border border-slate-700 hover:bg-slate-700 transition min-h-[44px] min-w-[44px]"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat with {otherPerson?.name?.split(" ")[0] || "Student"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Order Card */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 mb-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
              {rental.fulfillment}
            </span>
            <h1 className="text-lg font-bold text-white mt-1.5">
              {rental.listing?.title || "Rental Item"}
            </h1>
          </div>
          <div className="text-right">
            <span className="text-lg font-extrabold text-brand-teal">₹{rental.total_amount}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Payment: <strong className={rental.payment_status === "PAID" ? "text-emerald-400" : "text-amber-400"}>{rental.payment_status}</strong>
            </p>
          </div>
        </div>

        {/* Other Person Details (Strict Privacy: Name and College only) */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-brand-teal">
              {otherPerson?.name?.charAt(0) || "S"}
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {userRole === "renter" ? "Owner: " : "Renter: "} {otherPerson?.name || "Student"}
              </p>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Building className="w-3 h-3 text-slate-500" />
                {otherPerson?.college || "Campus Member"}
              </p>
            </div>
          </div>
          {otherPerson?.verification_status === "APPROVED" && (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Verified
            </span>
          )}
        </div>

        {/* Pricing and Dates Breakdown */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Duration</span>
            <span className="text-white font-medium">
              {rental.start_date} to {rental.end_date} ({rental.days} days)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Rate</span>
            <span className="text-white font-medium">₹{rental.price_per_day} / day</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span>Security Deposit</span>
            <span>₹0 (Guaranteed)</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span>Platform Fee</span>
            <span>₹0 (Student Benefit)</span>
          </div>
          {rental.pickup_note && (
            <div className="pt-2 border-t border-slate-800">
              <span className="text-slate-400 block mb-0.5">Pickup Point:</span>
              <p className="text-xs text-white font-medium">{rental.pickup_note}</p>
            </div>
          )}
          {rental.message && (
            <div className="pt-2 border-t border-slate-800">
              <span className="text-slate-400 block mb-0.5">Note:</span>
              <p className="text-xs text-slate-200 italic">&ldquo;{rental.message}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      {/* Allowed Actions Section */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 mb-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Order Actions</h2>

        {/* REQUESTED Actions */}
        {rental.status === "REQUESTED" && (
          <div className="space-y-2">
            {userRole === "owner" ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleTransition("ACCEPTED")}
                  disabled={actionLoading}
                  className="py-3 px-4 rounded-xl bg-brand-teal text-slate-950 font-bold text-xs hover:bg-brand-teal-light transition min-h-[44px] min-w-[44px]"
                >
                  Accept Request
                </button>
                <button
                  onClick={() => handleTransition("REJECTED")}
                  disabled={actionLoading}
                  className="py-3 px-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 font-bold text-xs hover:bg-red-500/20 transition min-h-[44px] min-w-[44px]"
                >
                  Decline Request
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleTransition("CANCELLED")}
                disabled={actionLoading}
                className="w-full py-3 px-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 font-bold text-xs hover:bg-red-500/20 transition min-h-[44px] min-w-[44px]"
              >
                Cancel Request
              </button>
            )}
            <p className="text-[11px] text-slate-400 text-center">
              Requests automatically expire if unanswered after 48 hours.
            </p>
          </div>
        )}

        {/* ACCEPTED Actions */}
        {rental.status === "ACCEPTED" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              {userRole === "owner" ? (
                <>
                  {rental.payment_status !== "PAID" ? (
                    <button
                      onClick={() => handleTransition("CONFIRMED", "PAID")}
                      disabled={actionLoading}
                      className="py-3 px-4 rounded-xl bg-brand-teal text-slate-950 font-bold text-xs hover:bg-brand-teal-light transition min-h-[44px] min-w-[44px]"
                    >
                      Accept Payment &amp; Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTransition("CONFIRMED")}
                      disabled={actionLoading}
                      className="py-3 px-4 rounded-xl bg-brand-teal text-slate-950 font-bold text-xs hover:bg-brand-teal-light transition min-h-[44px] min-w-[44px]"
                    >
                      Confirm Rental
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => handleTransition("CONFIRMED")}
                  disabled={actionLoading}
                  className="py-3 px-4 rounded-xl bg-brand-teal text-slate-950 font-bold text-xs hover:bg-brand-teal-light transition min-h-[44px] min-w-[44px]"
                >
                  Confirm Rental
                </button>
              )}
              <button
                onClick={() => handleTransition("CANCELLED")}
                disabled={actionLoading}
                className="py-3 px-4 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 font-semibold text-xs hover:text-white transition min-h-[44px] min-w-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* CONFIRMED or PICKUP_DELIVERY_PENDING Actions */}
        {(rental.status === "CONFIRMED" || rental.status === "PICKUP_DELIVERY_PENDING") && (
          <div className="space-y-3">
            {/* Owner-only payment confirmation when payment still pending */}
            {userRole === "owner" && rental.payment_status === "PENDING" && (
              <button
                onClick={async () => {
                  setActionLoading(true);
                  setError(null);
                  try {
                    const res = await fetch(`/api/rentals/${rental.id}/transition`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ to_status: rental.status, payment_status: "PAID" }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed");
                    setSuccess("Payment confirmed!");
                    await fetchRentalDetail();
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : "Failed");
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs hover:bg-emerald-500/20 transition flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px]"
              >
                <DollarSign className="w-4 h-4" />
                Confirm Payment Received ({rental.payment_method})
              </button>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowEvidenceModal("HANDOVER")}
                className="flex-1 py-3 px-4 rounded-xl bg-brand-teal text-slate-950 font-bold text-xs hover:bg-brand-teal-light transition flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px]"
              >
                <Camera className="w-4 h-4" />
                Upload Handover Photos
              </button>
              <button
                onClick={() => handleTransition("ITEM_PICKED_UP")}
                disabled={actionLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs hover:bg-slate-700 transition min-h-[44px] min-w-[44px]"
              >
                Confirm Handover
              </button>
            </div>
          </div>
        )}

        {/* ITEM_PICKED_UP Actions */}
        {rental.status === "ITEM_PICKED_UP" && (
          <button
            onClick={() => handleTransition("RENTAL_ACTIVE")}
            disabled={actionLoading}
            className="w-full py-3 px-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition min-h-[44px] min-w-[44px]"
          >
            Activate Rental Period
          </button>
        )}

        {/* RENTAL_ACTIVE Actions */}
        {rental.status === "RENTAL_ACTIVE" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              {userRole === "renter" ? (
                <button
                  onClick={() => handleTransition("RETURN_REQUESTED")}
                  disabled={actionLoading}
                  className="py-3 px-4 rounded-xl bg-brand-teal text-slate-950 font-bold text-xs hover:bg-brand-teal-light transition min-h-[44px] min-w-[44px]"
                >
                  Request Return
                </button>
              ) : (
                <button
                  onClick={() => setShowEvidenceModal("RETURN")}
                  className="py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs hover:bg-slate-700 transition flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px]"
                >
                  <Camera className="w-4 h-4" />
                  Return Evidence
                </button>
              )}
              <button
                onClick={() => handleTransition("DISPUTED")}
                disabled={actionLoading}
                className="py-3 px-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-xs hover:bg-rose-500/20 transition min-h-[44px] min-w-[44px]"
              >
                Open Dispute
              </button>
            </div>
            {userRole === "owner" && (
              <button
                onClick={() => handleTransition("DAMAGED_REVIEW")}
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold text-xs hover:bg-amber-500/20 transition min-h-[44px] min-w-[44px]"
              >
                Flag Item Damage / Review
              </button>
            )}
          </div>
        )}

        {/* RETURN_REQUESTED or RETURN_DELIVERY Actions */}
        {(rental.status === "RETURN_REQUESTED" || rental.status === "RETURN_DELIVERY") && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setShowEvidenceModal("RETURN")}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs hover:bg-slate-700 transition flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px]"
              >
                <Camera className="w-4 h-4" />
                Add Return Photos
              </button>
              {userRole === "owner" && (
                <button
                  onClick={() => handleTransition("RETURNED")}
                  disabled={actionLoading}
                  className="flex-1 py-3 px-4 rounded-xl bg-brand-teal text-slate-950 font-bold text-xs hover:bg-brand-teal-light transition min-h-[44px] min-w-[44px]"
                >
                  Confirm Item Returned
                </button>
              )}
            </div>
          </div>
        )}

        {/* RETURNED Actions */}
        {rental.status === "RETURNED" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleTransition("COMPLETED")}
              disabled={actionLoading}
              className="py-3 px-4 rounded-xl bg-brand-teal text-slate-950 font-bold text-xs hover:bg-brand-teal-light transition min-h-[44px] min-w-[44px]"
            >
              Mark Completed
            </button>
            {userRole === "owner" && (
              <button
                onClick={() => handleTransition("DAMAGED_REVIEW")}
                disabled={actionLoading}
                className="py-3 px-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold text-xs hover:bg-orange-500/20 transition min-h-[44px] min-w-[44px]"
              >
                Report Damage
              </button>
            )}
          </div>
        )}

        {/* DAMAGED_REVIEW or DISPUTED Actions */}
        {(rental.status === "DAMAGED_REVIEW" || rental.status === "DISPUTED") && (
          <div className="space-y-2">
            <p className="text-xs text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              This rental is currently under dispute/damage review. Both parties can upload photos and communicate via chat to resolve.
            </p>
            <button
              onClick={() => handleTransition("COMPLETED")}
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs hover:bg-slate-700 transition min-h-[44px] min-w-[44px]"
            >
              Resolve & Mark Completed
            </button>
          </div>
        )}

        {/* Terminal statuses (COMPLETED, CANCELLED, REJECTED, EXPIRED) */}
        {["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(rental.status) && (
          <p className="text-xs text-slate-400 text-center py-1">
            This rental order is closed ({rental.status.replace(/_/g, " ")}).
          </p>
        )}
      </div>

      {/* Handover & Return Evidence Viewer */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Condition & Return Evidence
          </h2>
          <button
            onClick={() => setShowEvidenceModal("HANDOVER")}
            className="text-[11px] font-bold text-brand-teal hover:underline flex items-center gap-1 min-h-[44px] min-w-[44px]"
          >
            <Camera className="w-3.5 h-3.5" />
            + Add Evidence
          </button>
        </div>

        {((rental as any).evidence?.length || 0) === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">
            No evidence photos or condition notes recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {(rental as any).evidence.map((ev: RentalEvidence) => (
              <div key={ev.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-brand-teal uppercase tracking-wider text-[10px]">
                    {ev.type} EVIDENCE
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(ev.created_at).toLocaleDateString()}
                  </span>
                </div>

                {ev.condition_notes && (
                  <p className="text-slate-300 mb-1.5"><strong className="text-slate-400">Notes:</strong> {ev.condition_notes}</p>
                )}
                {ev.damage_notes && (
                  <p className="text-rose-400 mb-1.5"><strong className="text-rose-500">Damage:</strong> {ev.damage_notes}</p>
                )}

                {ev.signed_photo_urls && ev.signed_photo_urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {ev.signed_photo_urls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative h-20 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 group block min-h-[44px] min-w-[44px]"
                      >
                        {/* eslint-disable-next-next/no-img-element */}
                        <img src={url} alt="Evidence" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/60 rounded px-1 text-[9px] text-white flex items-center gap-0.5">
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Timeline */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Status Timeline</h2>
        {((rental as any).status_events?.length || 0) === 0 ? (
          <p className="text-xs text-slate-500 italic">No timeline events recorded.</p>
        ) : (
          <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800">
            {(rental as any).status_events.map((evt: RentalStatusEvent) => (
              <div key={evt.id} className="relative flex items-start gap-3 pl-6">
                <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-brand-teal border-2 border-slate-950 -translate-x-1/2" />
                <div className="flex-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white capitalize">
                      {evt.to_status.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(evt.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {evt.note && <p className="text-slate-400 text-[11px] mt-0.5">{evt.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Evidence Modal */}
      {showEvidenceModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-white">
                Record {showEvidenceModal === "HANDOVER" ? "Handover" : "Return"} Evidence
              </h3>
              <button
                onClick={() => setShowEvidenceModal(null)}
                className="w-11 h-11 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center min-h-[44px] min-w-[44px]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEvidenceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Photos (Up to 6, max 5MB each)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 6) {
                      setError("Maximum 6 photos allowed");
                      return;
                    }
                    setEvidenceFiles(files);
                  }}
                  className="w-full text-base text-slate-400 file:mr-3 file:py-2.5 file:px-3 file:rounded-xl file:border-0 file:text-base file:font-semibold file:bg-brand-teal file:text-slate-950 hover:file:bg-brand-teal-light min-h-[44px] min-w-[44px]"
                />
                {evidenceFiles.length > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    {evidenceFiles.length} photo(s) selected
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Condition Notes
                </label>
                <textarea
                  rows={2}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="e.g. Scratches on back cover, screen working perfectly..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-base focus:outline-none focus:border-brand-teal min-h-[44px] resize-none"
                />
              </div>

              {showEvidenceModal === "RETURN" && (
                <div>
                  <label className="block text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1.5">
                    Damage Notes (if any)
                  </label>
                  <textarea
                    rows={2}
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    placeholder="Describe any new damages observed upon return..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-base focus:outline-none focus:border-rose-500 min-h-[44px] resize-none"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEvidenceModal(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-xs min-h-[44px] min-w-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingEvidence}
                  className="flex-1 py-3 rounded-xl bg-brand-teal text-slate-950 font-bold text-xs hover:bg-brand-teal-light transition flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] disabled:opacity-50"
                >
                  {uploadingEvidence ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Upload & Save"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
