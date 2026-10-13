"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function TopNav() {
  const pathname = usePathname();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Hide on auth pages
  const hideOnPaths = ["/login", "/signup", "/reset-password"];
  const isHidden = hideOnPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  useEffect(() => {
    if (isHidden) return;

    // Fetch initial notification unread count
    const fetchCounts = async () => {
      try {
        const notifRes = await fetch("/api/notifications");
        if (notifRes.ok) {
          const data = await notifRes.json();
          setUnreadNotifications(data.unread_count || 0);
        }

        const convRes = await fetch("/api/conversations");
        if (convRes.ok) {
          const data = await convRes.json();
          const totalUnread = (data.conversations || []).reduce(
            (acc: number, c: any) => acc + (c.unread_count || 0),
            0
          );
          setUnreadMessages(totalUnread);
        }
      } catch {
        // Safe ignore
      }
    };

    fetchCounts();

    // Supabase Realtime listener
    const supabase = createClient();
    const channel = supabase
      .channel("top-nav-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          setUnreadNotifications((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          setUnreadMessages((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pathname, isHidden]);

  if (isHidden) return null;

  return (
    <header className="sticky top-0 z-30 bg-[#090D16]/90 backdrop-blur-md border-b border-slate-800/80 px-4 h-14 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 group">
        <span className="text-xl font-black text-white tracking-tight group-hover:text-brand-teal transition">
          RENTIQ
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
          Campus
        </span>
      </Link>

      <div className="flex items-center gap-1.5">
        <Link
          href="/messages"
          aria-label="Messages"
          className="relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 transition min-h-[44px] min-w-[44px]"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadMessages > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-brand-teal text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center px-1 shadow">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </Link>

        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 transition min-h-[44px] min-w-[44px]"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-amber-400 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center px-1 shadow">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
