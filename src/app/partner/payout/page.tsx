"use client";

import { useState } from "react";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

export default function PartnerPayoutPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [pan, setPan] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFullNameValid = fullName.trim().length > 0;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isMobileValid = /^\d{10}$/.test(mobile.trim());
  const isPanValid = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(pan.trim());
  const isAccountNumberValid = /^\d{9,18}$/.test(accountNumber.trim());
  const isIfscValid = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifsc.trim());

  const isValid =
    isFullNameValid &&
    isEmailValid &&
    isMobileValid &&
    isPanValid &&
    isAccountNumberValid &&
    isIfscValid &&
    confirmed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/partner/payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          pan: pan.trim().toUpperCase(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
        }),
      });

      if (res.ok) {
        setSuccess("Payout details saved.");
        setError(null);
        setPan("");
        setAccountNumber("");
        setIfsc("");
        setConfirmed(false);
      } else {
        let message = "Failed to save payout details.";
        try {
          const data = await res.json();
          if (typeof data === "string") {
            message = data;
          } else if (data && typeof data.message === "string") {
            message = data.message;
          } else if (data && typeof data.error === "string") {
            message = data.error;
          } else if (data?.error && typeof data.error.description === "string") {
            message = data.error.description;
          } else if (data?.error && typeof data.error.message === "string") {
            message = data.error.message;
          }
        } catch {
          try {
            const text = await res.text();
            if (text) message = text;
          } catch {}
        }
        setError(message);
        setSuccess(null);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to submit payout details.");
      setSuccess(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col px-4 py-6 max-w-xl mx-auto w-full text-base"
      style={{
        paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))",
        paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
        paddingLeft: "calc(1rem + env(safe-area-inset-left, 0px))",
        paddingRight: "calc(1rem + env(safe-area-inset-right, 0px))",
      }}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Partner Payout Details</h1>
        <p className="text-base text-slate-400 mt-1">
          Enter your bank account information to receive delivery earnings.
        </p>
      </header>

      <div className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-800 text-base text-slate-300">
        Payouts are sent to this bank account by Razorpay on their settlement schedule.
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-base flex items-center gap-3">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-base flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="fullName" className="block text-base font-semibold text-slate-300 mb-2">
            Full name (as on bank account)
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px]"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-base font-semibold text-slate-300 mb-2">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. rahul@example.com"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px]"
          />
        </div>

        <div>
          <label htmlFor="mobile" className="block text-base font-semibold text-slate-300 mb-2">
            Mobile (10 digits)
          </label>
          <input
            id="mobile"
            name="mobile"
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="e.g. 9876543210"
            maxLength={10}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px]"
          />
        </div>

        <div>
          <label htmlFor="pan" className="block text-base font-semibold text-slate-300 mb-2">
            PAN (format AAAAA9999A)
          </label>
          <input
            id="pan"
            name="pan"
            type="text"
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase())}
            placeholder="e.g. ABCDE1234F"
            maxLength={10}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px] uppercase"
          />
        </div>

        <div>
          <label htmlFor="accountNumber" className="block text-base font-semibold text-slate-300 mb-2">
            Bank account number
          </label>
          <input
            id="accountNumber"
            name="accountNumber"
            type="text"
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="e.g. 123456789012"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px]"
          />
        </div>

        <div>
          <label htmlFor="ifsc" className="block text-base font-semibold text-slate-300 mb-2">
            IFSC code
          </label>
          <input
            id="ifsc"
            name="ifsc"
            type="text"
            value={ifsc}
            onChange={(e) => setIfsc(e.target.value.toUpperCase())}
            placeholder="e.g. HDFC0000123"
            maxLength={11}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px] uppercase"
          />
        </div>

        <div className="pt-2">
          <label className="flex items-start gap-3 cursor-pointer text-base text-slate-300">
            <input
              id="confirmed"
              name="confirmed"
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-700 bg-slate-900 text-brand-teal focus:ring-brand-teal min-h-[20px] min-w-[20px]"
            />
            <span className="text-base select-none">I confirm these details are mine.</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full py-3.5 px-4 bg-brand-teal text-slate-950 font-bold rounded-xl shadow-lg shadow-brand-teal/20 hover:bg-brand-teal-light transition duration-150 flex items-center justify-center gap-2 min-h-[44px] text-base disabled:opacity-50 disabled:cursor-not-allowed mt-6"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Payout Details"
          )}
        </button>
      </form>
    </div>
  );
}
