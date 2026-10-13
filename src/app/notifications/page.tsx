"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShoppingBag,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Notification } from "@/types";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load notifications");
      }
      setNotifications(data.notifications || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading notifications";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Supabase Realtime for new notifications
    const supabase = createClient();
    const channel = supabase
      .channel("notifications-page-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: any) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleMarkAsRead = async (notificationId?: string, link?: string | null) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          notificationId ? { notification_id: notificationId } : { mark_all: true }
        ),
      });

      if (notificationId) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
          )
        );
      } else {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
        );
      }

      if (link) {
        router.push(link);
      }
    } catch {
      // Safe ignore
    }
  };

  const getNotifIcon = (type: string) => {
    if (type.includes("MESSAGE")) {
      return <MessageSquare className="w-4 h-4 text-blue-400" />;
    }
    if (type.includes("RENTAL")) {
      return <ShoppingBag className="w-4 h-4 text-brand-teal" />;
    }
    return <Bell className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Notifications</h1>
          <p className="text-xs text-slate-400 mt-0.5">Stay updated on your rental requests and messages</p>
        </div>
        {notifications.some((n) => !n.read_at) && (
          <button
            onClick={() => handleMarkAsRead()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition min-h-[44px]"
          >
            <Check className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-2" />
          <p className="text-xs text-slate-400">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900/60 rounded-3xl border border-slate-800/80">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
            <Bell className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">No notifications yet</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            You will be notified here when someone requests to rent your items, responds to your requests, or sends you a chat message.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => {
            const isUnread = !n.read_at;

            return (
              <div
                key={n.id}
                onClick={() => handleMarkAsRead(n.id, n.link)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 min-h-[56px] ${
                  isUnread
                    ? "bg-slate-900/90 border-brand-teal/40 hover:border-brand-teal"
                    : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  {getNotifIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h3 className={`text-xs truncate ${isUnread ? "font-bold text-white" : "font-semibold text-slate-300"}`}>
                      {n.title}
                    </h3>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(n.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {n.body}
                  </p>
                </div>

                {isUnread && (
                  <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
