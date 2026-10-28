"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  MapPin,
  Package,
  Printer,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface ServiceOrder {
  kind: "PRINT" | "PARCEL";
  order_id: string;
  pickup_zone: string;
  job_status: string | null;
  payment_status: string;
  total_amount: number;
  created_at: string;
  partner_assigned: boolean;
}

function getPlainWordsStatus(
  job_status: string | null,
  kind: "PRINT" | "PARCEL"
): string {
  if (!job_status || job_status === "SEARCHING_PARTNER") {
    return "Looking for a partner";
  }

  switch (job_status) {
    case "ACCEPTED":
      return "Partner assigned";
    case "AT_SHOP":
      return kind === "PARCEL"
        ? "Partner is at the pickup point"
        : "At the shop";
    case "PRINTING":
      return kind === "PRINT" ? "Printing" : "Pickup in progress";
    case "PICKED_UP":
      return "Picked up";
    case "IN_TRANSIT":
      return "On the way to you";
    case "ARRIVED_AT_DROP":
      return "Arrived at drop point";
    case "DELIVERED":
      return "Delivered. Share your code to finish.";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    case "NO_PARTNER_FOUND":
      return "No partner found";
    default:
      return job_status.replace(/_/g, " ");
  }
}

export default function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [codes, setCodes] = useState<Record<string, string>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string | null>>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    setPageError(null);
    try {
      const { data, error } = await supabase.rpc("get_my_orders");
      if (error) {
        setPageError(error.message || "Failed to load orders.");
        return;
      }
      if (data && Array.isArray(data)) {
        setOrders(data as ServiceOrder[]);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      setPageError(err?.message || "Failed to load orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => {
      loadOrders();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  useEffect(() => {
    orders.forEach(async (order) => {
      const isExcluded =
        order.job_status === "COMPLETED" ||
        order.job_status === "CANCELLED" ||
        order.job_status === "NO_PARTNER_FOUND";

      if (
        order.partner_assigned &&
        !isExcluded &&
        !codes[order.order_id] &&
        !fetchingRef.current.has(order.order_id)
      ) {
        fetchingRef.current.add(order.order_id);
        try {
          const { data, error } = await supabase.rpc("get_my_handover_code", {
            p_job_kind: order.kind,
            p_order_id: order.order_id,
          });

          if (error) {
            setCardErrors((prev) => ({
              ...prev,
              [order.order_id]: error.message || "Failed to load handover code.",
            }));
          } else if (data) {
            setCodes((prev) => ({
              ...prev,
              [order.order_id]: data,
            }));
          }
        } catch (err: any) {
          setCardErrors((prev) => ({
            ...prev,
            [order.order_id]: err?.message || "Failed to load handover code.",
          }));
        }
      }
    });
  }, [orders, codes]);

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
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Service Orders
          </h1>
          <p className="text-base text-slate-400 mt-1">
            Track your print and parcel deliveries.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadOrders(true)}
          disabled={loading || refreshing}
          className="min-h-[44px] px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-base font-medium rounded-xl flex items-center gap-2 transition disabled:opacity-50"
          aria-label="Refresh orders"
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

      {loading && orders.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#00E5B0] animate-spin mb-2" />
          <p className="text-base text-slate-400">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
          <Package className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-base font-medium text-slate-300 mb-4">
            No orders yet.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
            <Link
              href="/print"
              className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 bg-[#00E5B0] hover:bg-[#00c99a] text-slate-950 text-base font-semibold rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Printer className="w-5 h-5" />
              <span>Print order</span>
            </Link>
            <Link
              href="/parcel"
              className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-base font-semibold rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Package className="w-5 h-5" />
              <span>Parcel delivery</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const cardError = cardErrors[order.order_id];
            const showCode =
              order.partner_assigned &&
              order.job_status !== "COMPLETED" &&
              order.job_status !== "CANCELLED" &&
              order.job_status !== "NO_PARTNER_FOUND";

            return (
              <div
                key={order.order_id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 shadow-lg"
              >
                {/* Header: Kind Badge & Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {order.kind === "PRINT" ? (
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
                    {getPlainWordsStatus(order.job_status, order.kind)}
                  </span>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-2 pt-1 text-base">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-5 h-5 text-[#00E5B0] shrink-0 mt-0.5" />
                    <div className="text-base text-white">
                      <span className="text-slate-400">Pickup zone: </span>
                      <span className="font-medium text-white">
                        {order.pickup_zone}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pl-7 pt-1 border-t border-slate-800/80">
                    <div className="text-base text-slate-300">
                      Total:{" "}
                      <span className="font-bold text-white">
                        ₹{order.total_amount}
                      </span>
                    </div>
                    <div className="text-base text-slate-300">
                      Payment: {order.payment_status}
                    </div>
                  </div>
                </div>

                {/* Handover Code */}
                {showCode && (
                  <div className="mt-2 bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-center">
                    <p className="text-base text-slate-300 font-medium mb-1">
                      Show this code to your partner at handover
                    </p>
                    {codes[order.order_id] ? (
                      <div className="text-3xl font-mono font-bold tracking-[0.25em] text-[#00E5B0]">
                        {codes[order.order_id]}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-1 text-slate-400 text-base">
                        <Loader2 className="w-5 h-5 animate-spin text-[#00E5B0]" />
                        <span>Loading code...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Card Error Display */}
                {cardError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2 mt-1">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-base text-rose-300">{cardError}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
