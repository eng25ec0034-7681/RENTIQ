"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PRINT_ZONES, type PrintZone } from "@/lib/print/zones";
import {
  MAX_PARCEL_WEIGHT_KG,
  BANNED_ITEMS_TEXT,
} from "@/lib/parcel/parcelRules";
import {
  parcelSchema,
  PARCEL_PAYMENT_METHODS,
} from "@/lib/validation/parcelSchema";

interface SubmittedTotals {
  order_id: string;
  parcel_fee: number;
  platform_fee: number;
  total_amount: number;
}

const supabase = createClient();

export default function ParcelPage() {
  // Form state
  const [pickupZone, setPickupZone] = useState<string>("");
  const [dropPoint, setDropPoint] = useState<string>("");
  const [itemDescription, setItemDescription] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("1");
  const [noBannedItems, setNoBannedItems] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PARCEL_PAYMENT_METHODS)[number]>("CASH");

  // Pricing state loaded from platform_settings
  const [parcelFee, setParcelFee] = useState<number | null>(null);
  const [platformFee, setPlatformFee] = useState<number | null>(null);

  // Status state
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedTotals, setSubmittedTotals] = useState<SubmittedTotals | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFees() {
      try {
        const { data, error: feeError } = await supabase
          .from("platform_settings")
          .select("key, value")
          .in("key", ["parcel_fee", "platform_fee"]);

        if (!feeError && data && isMounted) {
          data.forEach((row: { key: string; value: unknown }) => {
            const parsed = typeof row.value === "number" ? row.value : Number(row.value);
            if (!isNaN(parsed)) {
              if (row.key === "parcel_fee") {
                setParcelFee(parsed);
              } else if (row.key === "platform_fee") {
                setPlatformFee(parsed);
              }
            }
          });
        }
      } catch (err) {
        console.warn("Could not load platform settings:", err);
      }
    }

    loadFees();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!noBannedItems) {
      setError("You must confirm no banned items");
      return;
    }

    const trimmedPickupZone = pickupZone.trim();
    const trimmedDropPoint = dropPoint.trim();
    const trimmedDescription = itemDescription.trim();
    const parsedWeight = parseFloat(weightKg);

    const validation = parcelSchema.safeParse({
      pickup_zone: trimmedPickupZone,
      drop_point: trimmedDropPoint,
      item_description: trimmedDescription,
      weight_kg: parsedWeight,
      no_banned_items: noBannedItems,
      payment_method: paymentMethod,
    });

    if (!validation.success) {
      const firstErrorMessage = validation.error.errors[0]?.message || "Validation failed";
      setError(firstErrorMessage);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/parcel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup_zone: validation.data.pickup_zone,
          drop_point: validation.data.drop_point,
          item_description: validation.data.item_description,
          weight_kg: validation.data.weight_kg,
          no_banned_items: validation.data.no_banned_items,
          payment_method: validation.data.payment_method,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        let errorMessage = result.error || "Failed to create parcel order.";
        if (result.details) {
          const fieldDetails = Object.entries(result.details)
            .map(([k, msgs]) => `${k}: ${(msgs as string[]).join(", ")}`)
            .join("; ");
          errorMessage = `${errorMessage}: ${fieldDetails}`;
        }
        setError(errorMessage);
        setSubmitting(false);
        return;
      }

      setSubmittedTotals({
        order_id: result.order_id,
        parcel_fee: Number(result.parcel_fee),
        platform_fee: Number(result.platform_fee),
        total_amount: Number(result.total_amount),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setPickupZone("");
    setDropPoint("");
    setItemDescription("");
    setWeightKg("1");
    setNoBannedItems(false);
    setPaymentMethod("CASH");
    setError(null);
    setSubmittedTotals(null);
  };

  const previewTotal =
    parcelFee !== null && platformFee !== null ? parcelFee + platformFee : null;

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
        <h1 className="text-2xl font-bold text-white tracking-tight">Campus Parcel Delivery</h1>
        <p className="text-sm text-slate-400 mt-1">
          Pick up from a campus zone and deliver anywhere on campus, carried by an online student partner.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 p-4 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-sm"
        >
          {error}
        </div>
      )}

      {submittedTotals ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-500/20 text-[#00E5B0] rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
              ✓
            </div>
            <h2 className="text-xl font-bold text-white">Parcel Order Placed Successfully</h2>
            <p className="text-xs text-slate-400 mt-1">Order ID: {submittedTotals.order_id}</p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Order Totals</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Parcel fee</span>
                <span>₹{submittedTotals.parcel_fee}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Platform fee</span>
                <span>₹{submittedTotals.platform_fee}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-white text-base">
                <span>Total</span>
                <span className="text-[#00E5B0]">₹{submittedTotals.total_amount}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Parcels are carried by students. Do not send anything you are not allowed to carry.
          </p>

          <button
            type="button"
            onClick={handleReset}
            className="w-full min-h-[44px] h-[44px] bg-[#00E5B0] hover:bg-[#00c99a] text-slate-950 font-semibold rounded-xl text-base flex items-center justify-center transition"
            style={{ minHeight: "44px", fontSize: "16px" }}
          >
            Place Another Parcel Order
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5"
        >
          {/* Pickup Zone */}
          <div>
            <label htmlFor="pickup-zone" className="block text-sm font-medium text-slate-300 mb-1">
              Pickup Zone
            </label>
            <input
              id="pickup-zone"
              type="text"
              list="zone-suggestions"
              value={pickupZone}
              onChange={(e) => setPickupZone(e.target.value)}
              placeholder="e.g. Library gate"
              maxLength={60}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-base text-[16px] focus:outline-none focus:border-[#00E5B0] min-h-[44px]"
              style={{ fontSize: "16px", minHeight: "44px" }}
            />
            <datalist id="zone-suggestions">
              {PRINT_ZONES.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </div>

          {/* Drop Point */}
          <div>
            <label htmlFor="drop-point" className="block text-sm font-medium text-slate-300 mb-1">
              Drop Point
            </label>
            <input
              id="drop-point"
              type="text"
              value={dropPoint}
              onChange={(e) => setDropPoint(e.target.value)}
              placeholder="e.g. Room 304, Hostel Block A"
              minLength={3}
              maxLength={200}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Item Description */}
          <div>
            <label htmlFor="item-description" className="block text-sm font-medium text-slate-300 mb-1">
              Item Description
            </label>
            <input
              id="item-description"
              type="text"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="e.g. Textbooks and stationery"
              minLength={3}
              maxLength={200}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Weight (kg) */}
          <div>
            <label htmlFor="weight-kg" className="block text-sm font-medium text-slate-300 mb-1">
              Weight (kg) - Max {MAX_PARCEL_WEIGHT_KG} kg
            </label>
            <input
              id="weight-kg"
              type="number"
              step="0.1"
              min="0.1"
              max={MAX_PARCEL_WEIGHT_KG}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder={`Max ${MAX_PARCEL_WEIGHT_KG} kg`}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Payment Method */}
          <div>
            <label htmlFor="payment-method" className="block text-sm font-medium text-slate-300 mb-1">
              Payment Method
            </label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as (typeof PARCEL_PAYMENT_METHODS)[number])}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
              style={{ fontSize: "16px" }}
            >
              {PARCEL_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          {/* Banned-items Checkbox */}
          <div className="pt-1">
            <label
              htmlFor="no-banned-items"
              className="flex items-start gap-3 cursor-pointer select-none text-base text-[16px] text-slate-200"
              style={{ fontSize: "16px" }}
            >
              <input
                id="no-banned-items"
                type="checkbox"
                checked={noBannedItems}
                onChange={(e) => setNoBannedItems(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-slate-700 bg-slate-950 text-[#00E5B0] focus:ring-0 focus:ring-offset-0"
                style={{ fontSize: "16px" }}
              />
              <span className="text-sm leading-relaxed text-slate-300">
                {BANNED_ITEMS_TEXT}
              </span>
            </label>
          </div>

          {/* Price Summary */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Price Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Parcel fee</span>
                <span>{parcelFee !== null ? `₹${parcelFee}` : "—"}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Platform fee</span>
                <span>{platformFee !== null ? `₹${platformFee}` : "—"}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-white text-base">
                <span>Total</span>
                <span className="text-[#00E5B0]">
                  {previewTotal !== null ? `₹${previewTotal}` : "—"}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/60 pt-2">
              Parcels are carried by students. Do not send anything you are not allowed to carry.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !noBannedItems}
            className="w-full min-h-[44px] h-[44px] bg-[#00E5B0] hover:bg-[#00c99a] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-xl text-base flex items-center justify-center transition"
            style={{ minHeight: "44px", fontSize: "16px" }}
          >
            {submitting
              ? "Processing..."
              : previewTotal !== null
              ? `Place Parcel Order • ₹${previewTotal}`
              : "Place Parcel Order"}
          </button>
        </form>
      )}
    </div>
  );
}
