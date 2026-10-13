"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Calendar, Truck, MessageSquare, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import {
  createRentalSchema,
  calculateRentalAmounts,
  getTodayDateString,
} from "@/lib/validation/rentalSchema";

interface RentalRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: {
    id: string;
    title: string;
    price_per_day: number;
    max_rental_days?: number;
    delivery_available: boolean;
    pickup_available: boolean;
    pickup_zone?: string;
  };
}

export function RentalRequestModal({ isOpen, onClose, listing }: RentalRequestModalProps) {
  const router = useRouter();
  const today = getTodayDateString();

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">(
    listing.pickup_available ? "PICKUP" : "DELIVERY"
  );
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Live price calculation
  const pricing = calculateRentalAmounts(listing.price_per_day, startDate, endDate);
  const exceedsMaxDays = listing.max_rental_days
    ? pricing.days > listing.max_rental_days
    : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation using shared Zod schema
    const validation = createRentalSchema.safeParse({
      listing_id: listing.id,
      start_date: startDate,
      end_date: endDate,
      fulfillment,
      message: message.trim() || undefined,
      payment_method: paymentMethod,
    });

    if (!validation.success) {
      const issue = validation.error.errors[0]?.message || "Please check your dates";
      setError(issue);
      return;
    }

    if (exceedsMaxDays) {
      setError(`Duration cannot exceed maximum limit of ${listing.max_rental_days} days`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listing.id,
          start_date: startDate,
          end_date: endDate,
          fulfillment,
          message: message.trim() || undefined,
          payment_method: paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create rental request");
      }

      onClose();
      router.push(`/orders/${data.rental.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create rental request";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">Rent This Item</h2>
            <p className="text-xs text-slate-400 truncate max-w-[280px]">{listing.title}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center min-h-[44px] min-w-[44px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Dates Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  min={today}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base focus:outline-none focus:border-brand-teal min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                End Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base focus:outline-none focus:border-brand-teal min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {listing.max_rental_days && (
            <p className="text-[11px] text-slate-400">
              Maximum rental duration: <span className="text-white font-medium">{listing.max_rental_days} days</span>
            </p>
          )}

          {/* Fulfillment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Fulfillment Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFulfillment("PICKUP")}
                disabled={!listing.pickup_available}
                className={`py-3 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition min-h-[44px] ${
                  fulfillment === "PICKUP"
                    ? "bg-brand-teal/15 border-brand-teal text-brand-teal"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                } ${!listing.pickup_available ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <Calendar className="w-4 h-4" />
                Self Pickup
              </button>

              <button
                type="button"
                onClick={() => setFulfillment("DELIVERY")}
                disabled={!listing.delivery_available}
                className={`py-3 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition min-h-[44px] ${
                  fulfillment === "DELIVERY"
                    ? "bg-brand-teal/15 border-brand-teal text-brand-teal"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                } ${!listing.delivery_available ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <Truck className="w-4 h-4" />
                Campus Delivery
              </button>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Payment Method (at Handover)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition min-h-[44px] ${
                  paymentMethod === "CASH"
                    ? "bg-brand-teal/15 border-brand-teal text-brand-teal"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                💵 Cash at Handover
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("UPI")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition min-h-[44px] ${
                  paymentMethod === "UPI"
                    ? "bg-brand-teal/15 border-brand-teal text-brand-teal"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                📱 UPI at Handover
              </button>
            </div>
          </div>

          {/* Optional Message */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Message to Owner (Optional)
            </label>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Can meet in library foyer at 3 PM..."
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base focus:outline-none focus:border-brand-teal min-h-[44px] resize-none"
            />
          </div>

          {/* Live Price Breakdown Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-sm">
            <div className="flex justify-between text-slate-400 text-xs">
              <span>Rental duration</span>
              <span className="text-white font-medium">{pricing.days} {pricing.days === 1 ? "day" : "days"}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-xs">
              <span>Daily rate</span>
              <span className="text-white font-medium">₹{pricing.pricePerDay}/day</span>
            </div>
            <div className="flex justify-between text-slate-400 text-xs">
              <span>Rental amount</span>
              <span className="text-white font-medium">₹{pricing.rentalAmount}</span>
            </div>
            <div className="flex justify-between text-emerald-400 text-xs">
              <span>Security deposit</span>
              <span>₹0</span>
            </div>
            <div className="flex justify-between text-emerald-400 text-xs">
              <span>Platform fee</span>
              <span>₹0</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-base font-bold text-white">
              <span>Total to Pay</span>
              <span className="text-brand-teal text-lg">₹{pricing.totalAmount}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || exceedsMaxDays}
            className="w-full py-3.5 bg-brand-teal text-slate-950 font-bold rounded-xl shadow-lg shadow-brand-teal/20 hover:bg-brand-teal-light transition flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending Request...
              </>
            ) : (
              "Confirm & Send Request"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
