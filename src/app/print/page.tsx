"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PRINT_ZONES, type PrintZone } from "@/lib/print/zones";
import { calculatePrintOrderTotal } from "@/lib/print/pricing";

interface PrintOrderTotals {
  order_id?: string;
  printing_cost: number;
  delivery_fee: number;
  platform_fee: number;
  total_amount: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function PrintPage() {
  const supabase = createClient();

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | "">(1);
  const [copies, setCopies] = useState<number | "">(1);
  const [colour, setColour] = useState<boolean>(false);
  const [doubleSided, setDoubleSided] = useState<boolean>(false);
  const [paperSize, setPaperSize] = useState<"A4" | "A3">("A4");
  const [binding, setBinding] = useState<boolean>(false);
  const [stapling, setStapling] = useState<boolean>(false);
  const [pickupZone, setPickupZone] = useState<PrintZone>(PRINT_ZONES[0]);
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");

  // Auth & Pricing Settings
  const [userId, setUserId] = useState<string | null>(null);
  const [platformFee, setPlatformFee] = useState<number>(0);

  // Status State
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedTotals, setSubmittedTotals] = useState<PrintOrderTotals | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id && isMounted) {
          setUserId(authData.user.id);
        }
      } catch {
        // Fallback handled on submit
      }

      try {
        const { data, error: feeError } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "platform_fee")
          .maybeSingle();

        if (!feeError && data?.value !== undefined && data?.value !== null && isMounted) {
          const parsed = typeof data.value === "number" ? data.value : Number(data.value);
          if (!isNaN(parsed)) {
            setPlatformFee(parsed);
          }
        }
      } catch (err) {
        console.warn("Could not load platform_fee:", err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("File exceeds 10 MB limit.");
      setFile(null);
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const handleReset = () => {
    setSubmittedTotals(null);
    setFile(null);
    setPages(1);
    setCopies(1);
    setColour(false);
    setDoubleSided(false);
    setPaperSize("A4");
    setBinding(false);
    setStapling(false);
    setPickupZone(PRINT_ZONES[0]);
    setFulfillment("PICKUP");
    setPaymentMethod("CASH");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File exceeds 10 MB limit.");
      return;
    }

    const pagesNum = typeof pages === "number" ? pages : parseInt(pages as string, 10);
    if (isNaN(pagesNum) || pagesNum < 1 || pagesNum > 500) {
      setError("Pages must be between 1 and 500.");
      return;
    }

    const copiesNum = typeof copies === "number" ? copies : parseInt(copies as string, 10);
    if (isNaN(copiesNum) || copiesNum < 1 || copiesNum > 100) {
      setError("Copies must be between 1 and 100.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Resolve user ID
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          effectiveUserId = authData.user.id;
          setUserId(effectiveUserId);
        }
      }

      if (!effectiveUserId) {
        setError("Please sign in to place a print order.");
        setSubmitting(false);
        return;
      }

      // 2. Upload file to Supabase bucket "print-files" at {user_id}/{uuid}-{filename}
      const fileUuid = generateUUID();
      const storagePath = `${effectiveUserId}/${fileUuid}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("print-files")
        .upload(storagePath, file);

      if (uploadError) {
        setError(uploadError.message || "Failed to upload file to storage.");
        setSubmitting(false);
        return;
      }

      // 3. Post to /api/print
      const response = await fetch("/api/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pages: pagesNum,
          copies: copiesNum,
          colour,
          double_sided: doubleSided,
          doubleSided,
          paper_size: paperSize,
          paperSize,
          binding,
          stapling,
          pickup_zone: pickupZone,
          pickupZone,
          fulfillment,
          payment_method: paymentMethod,
          paymentMethod,
          file_path: storagePath,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        await supabase.storage.from("print-files").remove([storagePath]);
        const errorMessage =
          result.error ||
          (result.details
            ? Object.entries(result.details)
                .map(([k, msgs]) => `${k}: ${(msgs as string[]).join(", ")}`)
                .join("; ")
            : "Failed to create print order.");
        setError(errorMessage);
        setSubmitting(false);
        return;
      }

      // 4. Update submitted totals returned by /api/print
      setSubmittedTotals({
        order_id: result.order_id || result.orderId,
        printing_cost: Number(result.printing_cost ?? 0),
        delivery_fee: Number(result.delivery_fee ?? 0),
        platform_fee: Number(result.platform_fee ?? 0),
        total_amount: Number(result.total_amount ?? 0),
      });
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Pure function calculation for live preview
  const previewTotals = calculatePrintOrderTotal(
    {
      pages: typeof pages === "number" ? pages : 1,
      copies: typeof copies === "number" ? copies : 1,
      colour,
      doubleSided,
      paperSize,
      binding,
      stapling,
      fulfillment,
      paymentMethod,
    },
    {
      platform_fee: platformFee,
    }
  );

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
        <h1 className="text-2xl font-bold text-white tracking-tight">Print &amp; Xerox</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload documents for high-quality campus printing and delivery.
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
            <h2 className="text-xl font-bold text-white">Order Placed Successfully</h2>
            {submittedTotals.order_id && (
              <p className="text-xs text-slate-400 mt-1">Order ID: {submittedTotals.order_id}</p>
            )}
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Order Totals</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Printing</span>
                <span>₹{submittedTotals.printing_cost}</span>
              </div>
              {submittedTotals.delivery_fee > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Delivery</span>
                  <span>₹{submittedTotals.delivery_fee}</span>
                </div>
              )}
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
            Your file is deleted 48 hours after the order is completed.
          </p>

          <button
            type="button"
            onClick={handleReset}
            className="w-full min-h-[44px] h-[44px] bg-[#00E5B0] hover:bg-[#00c99a] text-slate-950 font-semibold rounded-xl text-base flex items-center justify-center transition"
          >
            Place Another Print Order
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5"
        >
          {/* File Upload */}
          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-slate-300 mb-1">
              Select Document
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="w-full text-base text-[16px] text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl p-2 focus:outline-none focus:border-[#00E5B0]"
              style={{ fontSize: "16px" }}
            />
            {file && (
              <p className="text-xs text-emerald-400 mt-1">
                Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              Your file is deleted 48 hours after the order is completed.
            </p>
          </div>

          {/* Pages and Copies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pages-input" className="block text-sm font-medium text-slate-300 mb-1">
                Pages (1 to 500)
              </label>
              <input
                id="pages-input"
                type="number"
                min={1}
                max={500}
                value={pages}
                onChange={(e) => {
                  const val = e.target.value;
                  setPages(val === "" ? "" : parseInt(val, 10));
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
                style={{ fontSize: "16px" }}
                required
              />
            </div>

            <div>
              <label htmlFor="copies-input" className="block text-sm font-medium text-slate-300 mb-1">
                Copies (1 to 100)
              </label>
              <input
                id="copies-input"
                type="number"
                min={1}
                max={100}
                value={copies}
                onChange={(e) => {
                  const val = e.target.value;
                  setCopies(val === "" ? "" : parseInt(val, 10));
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
                style={{ fontSize: "16px" }}
                required
              />
            </div>
          </div>

          {/* Paper Size */}
          <div>
            <label htmlFor="paper-size" className="block text-sm font-medium text-slate-300 mb-1">
              Paper Size
            </label>
            <select
              id="paper-size"
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value as "A4" | "A3")}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
              style={{ fontSize: "16px" }}
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </div>

          {/* Checkboxes: Colour, Double-Sided, Binding, Stapling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-3 cursor-pointer select-none text-base text-[16px] text-slate-200">
              <input
                type="checkbox"
                checked={colour}
                onChange={(e) => setColour(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 bg-slate-950 text-[#00E5B0] focus:ring-0 focus:ring-offset-0"
              />
              <span>Colour print</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none text-base text-[16px] text-slate-200">
              <input
                type="checkbox"
                checked={doubleSided}
                onChange={(e) => setDoubleSided(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 bg-slate-950 text-[#00E5B0] focus:ring-0 focus:ring-offset-0"
              />
              <span>Double-sided</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none text-base text-[16px] text-slate-200">
              <input
                type="checkbox"
                checked={binding}
                onChange={(e) => setBinding(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 bg-slate-950 text-[#00E5B0] focus:ring-0 focus:ring-offset-0"
              />
              <span>Binding</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none text-base text-[16px] text-slate-200">
              <input
                type="checkbox"
                checked={stapling}
                onChange={(e) => setStapling(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 bg-slate-950 text-[#00E5B0] focus:ring-0 focus:ring-offset-0"
              />
              <span>Stapling</span>
            </label>
          </div>

          {/* Pickup Zone */}
          <div>
            <label htmlFor="pickup-zone" className="block text-sm font-medium text-slate-300 mb-1">
              Pickup Zone
            </label>
            <select
              id="pickup-zone"
              value={pickupZone}
              onChange={(e) => setPickupZone(e.target.value as PrintZone)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
              style={{ fontSize: "16px" }}
            >
              {PRINT_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>

          {/* Fulfillment and Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fulfillment" className="block text-sm font-medium text-slate-300 mb-1">
                Fulfillment
              </label>
              <select
                id="fulfillment"
                value={fulfillment}
                onChange={(e) => setFulfillment(e.target.value as "PICKUP" | "DELIVERY")}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
                style={{ fontSize: "16px" }}
              >
                <option value="PICKUP">PICKUP</option>
                <option value="DELIVERY">DELIVERY</option>
              </select>
            </div>

            <div>
              <label htmlFor="payment-method" className="block text-sm font-medium text-slate-300 mb-1">
                Payment Method
              </label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "UPI")}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
                style={{ fontSize: "16px" }}
              >
                <option value="CASH">CASH</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
          </div>

          {/* Live Price Summary */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Price Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Printing</span>
                <span>₹{previewTotals.printing_cost}</span>
              </div>
              {fulfillment === "DELIVERY" && (
                <div className="flex justify-between text-slate-300">
                  <span>Delivery</span>
                  <span>₹{previewTotals.delivery_fee}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300">
                <span>Platform fee</span>
                <span>₹{previewTotals.platform_fee}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-white text-base">
                <span>Total</span>
                <span className="text-[#00E5B0]">₹{previewTotals.total_amount}</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] h-[44px] bg-[#00E5B0] hover:bg-[#00c99a] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-xl text-base flex items-center justify-center transition"
          >
            {submitting ? "Processing..." : `Order Print • ₹${previewTotals.total_amount}`}
          </button>
        </form>
      )}
    </div>
  );
}
