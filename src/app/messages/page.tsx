"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  MessageSquare,
  Search,
  Building,
  ShieldCheck,
  Loader2,
  Inbox,
  ArrowRight,
} from "lucide-react";
import { Conversation } from "@/types";

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/conversations");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load chats");
        }
        setConversations(data.conversations || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error loading chats";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [router]);

  return (
    <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-white tracking-tight">Messages</h1>
        <p className="text-xs text-slate-400 mt-0.5">Chat directly with student renters and item owners</p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-2" />
          <p className="text-xs text-slate-400">Loading conversations...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900/60 rounded-3xl border border-slate-800/80">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">No messages yet</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mb-5">
            When you contact an owner or receive inquiries about your listings, your conversations will show up here.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-teal text-slate-950 text-xs font-bold hover:bg-brand-teal-light transition min-h-[44px] min-w-[44px]"
          >
            Explore Listings
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {conversations.map((c) => {
            const other = c.other_user;
            const lastMsg = c.last_message;

            return (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-brand-teal/40 hover:bg-slate-800/60 transition group min-h-[64px] min-w-[44px]"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-brand-teal">
                    {other?.profile_photo_url ? (
                      // eslint-disable-next-next/no-img-element
                      <img
                        src={other.profile_photo_url}
                        alt={other.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      other?.name?.charAt(0) || "U"
                    )}
                  </div>
                  {c.unread_count && c.unread_count > 0 ? (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-teal text-slate-950 font-extrabold text-[10px] flex items-center justify-center shadow">
                      {c.unread_count > 9 ? "9+" : c.unread_count}
                    </span>
                  ) : null}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-brand-teal transition">
                      {other?.name || "Campus Student"}
                    </h3>
                    {lastMsg && (
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(lastMsg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>

                  {c.listing?.title && (
                    <p className="text-[11px] font-medium text-brand-teal/80 truncate mb-0.5">
                      Re: {c.listing.title}
                    </p>
                  )}

                  <p className="text-xs text-slate-400 truncate">
                    {lastMsg ? lastMsg.body : "No messages yet. Say hello!"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
