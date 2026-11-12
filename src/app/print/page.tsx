"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  calculatePrintTotals,
  BindingType,
  PaperSize,
  StationeryPick,
  PrintTotals,
  CatalogueEntry,
} from "@/lib/print/pricing";
import StationeryPicker, { StationeryItem } from "@/components/StationeryPicker";

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
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [bindingType, setBindingType] = useState<BindingType>("NONE");
  const [stationery, setStationery] = useState<Record<string, number>>({});
  const [dropPoint, setDropPoint] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [contactPhone, setContactPhone] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");

  // Catalogue
  const [catalogue, setCatalogue] = useState<StationeryItem[]>([]);
  const [catalogueMap, setCatalogueMap] = useState<Record<string, CatalogueEntry>>({});

  // Auth & Pricing Settings
  const [userId, setUserId] = useState<string | null>(null);

  // Status State
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedOrder, setSubmittedOrder] = useState<{
    order_id?: string;
    totals: PrintTotals;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id && isMounted) {
          setUserId(authData.user.id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("phone")
            .eq("id", authData.user.id)
            .maybeSingle();
          if (profile?.phone && isMounted) {
            setContactPhone(profile.phone);
          }
        }
      } catch {
        // Fallback handled on submit
      }

      try {
        const { data: items } = await supabase
          .from("stationery_items")
          .select("code,name,price,category")
          .eq("is_active", true)
          .order("sort");

        if (items && isMounted) {
          setCatalogue(items);
          const map: Record<string, CatalogueEntry> = {};
          for (const item of items) {
            map[item.code] = { name: item.name, price: item.price };
          }
          setCatalogueMap(map);
        }
      } catch (err) {
        console.error("Failed to load stationery catalogue", err);
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
    setSubmittedOrder(null);
    setFile(null);
    setPages(1);
    setCopies(1);
    setColour(false);
    setDoubleSided(false);
    setPaperSize("A4");
    setBindingType("NONE");
    setStationery({});
    setDropPoint("");
    setPaymentMethod("CASH");
    setError(null);
  };

  const stationeryPicks: StationeryPick[] = Object.entries(stationery)
    .filter(([_, qty]) => qty > 0)
    .map(([code, qty]) => ({ code, qty }));

  // Live preview totals using calculatePrintTotals from @/lib/print/pricing
  const previewTotals = calculatePrintTotals(
    {
      pages: typeof pages === "number" ? pages : 1,
      copies: typeof copies === "number" ? copies : 1,
      colour,
      doubleSided,
      paperSize,
      bindingType,
      fulfillment: "DELIVERY",
      stationery: stationeryPicks,
    },
    catalogueMap
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^[6-9][0-9]{9}$/.test(contactPhone.trim())) {
      setError("Enter a valid 10-digit mobile number so your partner can reach you.");
      return;
    }

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

    const trimmedDropPoint = dropPoint.trim();
    if (trimmedDropPoint.length < 3 || trimmedDropPoint.length > 200) {
      setError("Delivery location must be between 3 and 200 characters.");
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
          bindingType,
          stationery: stationeryPicks,
          drop_point: trimmedDropPoint,
          dropPoint: trimmedDropPoint,
          payment_method: paymentMethod,
          paymentMethod,
          contact_phone: contactPhone,
          file_path: storagePath,
          pickup_location: pickupLocation,
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

      // 4. Update submitted totals using calculatePrintTotals from @/lib/print/pricing
      const orderTotals = calculatePrintTotals(
        {
          pages: pagesNum,
          copies: copiesNum,
          colour,
          doubleSided,
          paperSize,
          bindingType,
          fulfillment: "DELIVERY",
          stationery: stationeryPicks,
        },
        catalogueMap
      );

      setSubmittedOrder({
        order_id: result.order_id || result.orderId,
        totals: orderTotals,
      });
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
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

      {submittedOrder ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-500/20 text-[#00E5B0] rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
              ✓
            </div>
            <h2 className="text-xl font-bold text-white">Order Placed Successfully</h2>
            {submittedOrder.order_id && (
              <p className="text-xs text-slate-400 mt-1">Order ID: {submittedOrder.order_id}</p>
            )}
          </div>

          <div className="rq-summary bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Order Totals</h3>
            <div className="space-y-2 text-sm">
              {submittedOrder.totals.lines.map((line, idx) => (
                <div key={idx} className="flex justify-between items-baseline text-slate-300">
                  <div className="flex flex-col">
                    <span>{line.label}</span>
                    {line.detail && (
                      <span className="text-xs text-slate-400">{line.detail}</span>
                    )}
                  </div>
                  <span className="font-medium text-white">₹{line.amount}</span>
                </div>
              ))}
              <div className="rq-summary-total border-t border-slate-800 pt-2 flex justify-between font-bold text-white text-base">
                <span>Total</span>
                <span className="text-[#00E5B0]">₹{submittedOrder.totals.total}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Your order is delivered by a student partner.
          </p>

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
              onChange={(e) => setPaperSize(e.target.value as PaperSize)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
              style={{ fontSize: "16px" }}
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </div>

          {/* Four Options Cards */}
          {/* Card 1: Colour mode */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2.5">
              Colour mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setColour(false)}
                aria-pressed={!colour}
                className={`rq-opt min-h-[44px] px-3 py-2.5 rounded-xl border text-sm font-medium transition flex flex-col items-center justify-center text-center ${
                  !colour
                    ? "border-[#00E5B0] bg-[#00E5B0]/10 text-white font-semibold"
                    : "border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <span>Black &amp; white</span>
                <span className="rq-opt-price">₹2/side</span>
              </button>
              <button
                type="button"
                onClick={() => setColour(true)}
                aria-pressed={colour}
                className={`rq-opt min-h-[44px] px-3 py-2.5 rounded-xl border text-sm font-medium transition flex flex-col items-center justify-center text-center ${
                  colour
                    ? "border-[#00E5B0] bg-[#00E5B0]/10 text-white font-semibold"
                    : "border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <span>Colour</span>
                <span className="rq-opt-price">₹10/side</span>
              </button>
            </div>
          </div>

          {/* Card 2: Sides */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2.5">
              Sides
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDoubleSided(false)}
                aria-pressed={!doubleSided}
                className={`rq-opt min-h-[44px] px-3 py-2.5 rounded-xl border text-sm font-medium transition flex flex-col items-center justify-center text-center ${
                  !doubleSided
                    ? "border-[#00E5B0] bg-[#00E5B0]/10 text-white font-semibold"
                    : "border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <span>Single side</span>
              </button>
              <button
                type="button"
                onClick={() => setDoubleSided(true)}
                aria-pressed={doubleSided}
                className={`rq-opt min-h-[44px] px-3 py-2.5 rounded-xl border text-sm font-medium transition flex flex-col items-center justify-center text-center ${
                  doubleSided
                    ? "border-[#00E5B0] bg-[#00E5B0]/10 text-white font-semibold"
                    : "border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <span>Front &amp; back</span>
                <span className="rq-opt-price">₹3/sheet</span>
              </button>
            </div>
          </div>

          {/* Card 3: Binding */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2.5">
              Binding
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { value: "NONE" as const, label: "No binding", sub: "" },
                { value: "STAPLE" as const, label: "Stapled", sub: "₹2" },
                { value: "SPIRAL" as const, label: "Spiral", sub: "₹40" },
                { value: "SOFT" as const, label: "Soft", sub: "₹30" },
              ].map((b) => {
                const isSelected = bindingType === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBindingType(b.value)}
                    aria-pressed={isSelected}
                    className={`rq-opt min-h-[44px] px-3 py-2 rounded-xl border text-sm font-medium transition flex flex-col items-center justify-center text-center ${
                      isSelected
                        ? "border-[#00E5B0] bg-[#00E5B0]/10 text-white font-semibold"
                        : "border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <span>{b.label}</span>
                    {b.sub && <span className="rq-opt-price">{b.sub}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 4: Stationery */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <StationeryPicker
              items={catalogue}
              value={stationery}
              onChange={setStationery}
            />
          </div>

          {/* Delivery location */}
          <div>
            <label htmlFor="delivery-location" className="block text-sm font-medium text-slate-300 mb-1">
              Delivery location
            </label>
            <input
              id="delivery-location"
              type="text"
              value={dropPoint}
              onChange={(e) => setDropPoint(e.target.value)}
              placeholder="e.g. Hostel Block B Room 302"
              minLength={3}
              maxLength={200}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-base text-[16px] focus:outline-none focus:border-[#00E5B0] min-h-[44px]"
              style={{ fontSize: "16px", minHeight: "44px" }}
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
              onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "UPI")}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-base text-[16px] focus:outline-none focus:border-[#00E5B0]"
              style={{ fontSize: "16px" }}
            >
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
            </select>
          </div>

          {/* Live Price Summary */}
          <div className="rq-summary bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Price Summary</h3>
            <div className="space-y-2 text-sm">
              {previewTotals.lines.map((line, idx) => (
                <div key={idx} className="flex justify-between items-baseline text-slate-300">
                  <div className="flex flex-col">
                    <span>{line.label}</span>
                    {line.detail && (
                      <span className="text-xs text-slate-400">{line.detail}</span>
                    )}
                  </div>
                  <span className="font-medium text-white">₹{line.amount}</span>
                </div>
              ))}
              <div className="rq-summary-total border-t border-slate-800 pt-2 flex justify-between font-bold text-white text-base">
                <span>Total</span>
                <span className="text-[#00E5B0]">₹{previewTotals.total}</span>
              </div>
            </div>
          </div>

          {/* Pickup Location */}
          <div className="mb-4">
            <label htmlFor="pickupLocation" className="block text-sm font-semibold text-slate-300 mb-1.5">
              Pickup location <span className="text-slate-500">(building, floor, room)</span>
            </label>
            <input
              id="pickupLocation"
              type="text"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder="e.g. Library Block, 2nd floor, Room 204"
              maxLength={120}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white text-base placeholder-slate-400 focus:outline-none focus:border-brand-teal min-h-[44px]"
            />
          </div>

          {/* Contact Phone */}
          <div className="mb-4">
            <label htmlFor="contactPhone" className="block text-sm font-semibold text-slate-300 mb-1.5">
              Mobile number for this delivery
            </label>
            <input
              id="contactPhone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="10-digit mobile number"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white text-base placeholder-slate-400 focus:outline-none focus:border-brand-teal min-h-[44px]"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="rq-cta w-full min-h-[44px] h-[44px] bg-[#00E5B0] hover:bg-[#00c99a] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-xl text-base flex items-center justify-center transition"
          >
            {submitting ? "Processing..." : `Order Print • ₹${previewTotals.total}`}
          </button>
        </form>
      )}
    </div>
  );
}
