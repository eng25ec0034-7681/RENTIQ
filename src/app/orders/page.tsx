"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRight,
  Loader2,
  Inbox,
  Sparkles,
} from "lucide-react";
import { Rental, RentalStatus } from "@/types";

export default function OrdersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"renter" | "owner">("renter");
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRentals = async (role: "renter" | "owner") => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/rentals?role=${role}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load rentals");
      }
      setRentals(data.rentals || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading rentals";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRentals(activeTab);
  }, [activeTab]);

  const getStatusBadge = (status: RentalStatus) => {
    switch (status) {
      case "REQUESTED":
        return { label: "Requested", bg: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" };
      case "ACCEPTED":
        return { label: "Accepted", bg: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
      case "PAYMENT_PENDING":
        return { label: "Payment Pending", bg: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "CONFIRMED":
        return { label: "Confirmed", bg: "bg-teal-500/10 text-brand-teal border-teal-500/30" };
      case "PICKUP_DELIVERY_PENDING":
        return { label: "Pickup Pending", bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
      case "ITEM_PICKED_UP":
        return { label: "Handed Over", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      case "RENTAL_ACTIVE":
        return { label: "Active Rental", bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" };
      case "RETURN_REQUESTED":
        return { label: "Return Requested", bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" };
      case "RETURN_DELIVERY":
        return { label: "Return In Progress", bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" };
      case "RETURNED":
        return { label: "Returned", bg: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
      case "COMPLETED":
        return { label: "Completed", bg: "bg-slate-700/50 text-slate-300 border-slate-600" };
      case "REJECTED":
        return { label: "Declined", bg: "bg-red-500/10 text-red-400 border-red-500/30" };
      case "CANCELLED":
        return { label: "Cancelled", bg: "bg-slate-800 text-slate-400 border-slate-700" };
      case "EXPIRED":
        return { label: "Expired", bg: "bg-neutral-800 text-neutral-400 border-neutral-700" };
      case "OVERDUE":
        return { label: "Overdue", bg: "bg-rose-500/20 text-rose-400 border-rose-500/40" };
      case "DISPUTED":
        return { label: "Disputed", bg: "bg-purple-500/20 text-purple-400 border-purple-500/40" };
      case "DAMAGED_REVIEW":
        return { label: "Damage Review", bg: "bg-orange-500/20 text-orange-400 border-orange-500/40" };
      default:
        return { label: status, bg: "bg-slate-800 text-slate-400 border-slate-700" };
    }
  };

  return (
    <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-white tracking-tight">Orders & Rentals</h1>
        <p className="text-xs text-slate-400 mt-0.5">Manage your active campus rentals and requests</p>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-5">
        <button
          onClick={() => setActiveTab("renter")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 ${
            activeTab === "renter"
              ? "bg-brand-teal text-slate-950 shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          My Rentals
        </button>

        <button
          onClick={() => setActiveTab("owner")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 ${
            activeTab === "owner"
              ? "bg-brand-teal text-slate-950 shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Inbox className="w-4 h-4" />
          Rental Requests
        </button>
      </div>

      {/* Content */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-2" />
          <p className="text-xs text-slate-400">Loading rentals...</p>
        </div>
      ) : rentals.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900/60 rounded-3xl border border-slate-800/80">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
            {activeTab === "renter" ? <ShoppingBag className="w-7 h-7" /> : <Inbox className="w-7 h-7" />}
          </div>
          <h2 className="text-base font-bold text-white mb-1">
            {activeTab === "renter" ? "No rentals yet" : "No requests received"}
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mb-5">
            {activeTab === "renter"
              ? "Browse listings to rent calculators, textbooks, sports gear, or electronics."
              : "When other students request to rent your listed items, they will appear here."}
          </p>
          {activeTab === "renter" ? (
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-teal text-slate-950 text-xs font-bold hover:bg-brand-teal-light transition min-h-[44px] min-w-[44px]"
            >
              <Sparkles className="w-4 h-4" />
              Explore Items
            </Link>
          ) : (
            <Link
              href="/give"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-teal text-slate-950 text-xs font-bold hover:bg-brand-teal-light transition min-h-[44px] min-w-[44px]"
            >
              List an Item
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rentals.map((rental) => {
            const badge = getStatusBadge(rental.status);
            const otherPerson = activeTab === "renter" ? rental.owner : rental.renter;

            return (
              <Link
                key={rental.id}
                href={`/orders/${rental.id}`}
                className="block p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition shadow-sm group min-h-[44px] min-w-[44px]"
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-white truncate group-hover:text-brand-teal transition">
                      {rental.listing?.title || "Rental Item"}
                    </h2>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {activeTab === "renter" ? "Owner: " : "Renter: "}
                      <span className="text-slate-200">{otherPerson?.name || "Student"}</span>
                      {otherPerson?.college && ` • ${otherPerson.college}`}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider shrink-0 ${badge.bg}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {rental.start_date} to {rental.end_date} ({rental.days}d)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-bold text-white">
                    <span>₹{rental.total_amount}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
