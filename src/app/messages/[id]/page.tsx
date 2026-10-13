"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  ShieldAlert,
  UserX,
  Loader2,
  Building,
  ShieldCheck,
  Check,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Message, Conversation, PublicProfile } from "@/types";

export default function ChatRoomPage() {
  const params = useParams();
  const convId = params.id as string;
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Menu and Modals
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChat = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/conversations/${convId}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load chat");
      }
      setConversation(data.conversation);
      setMessages(data.conversation.messages || []);
      setCurrentUserId(data.current_user_id);
      setIsBlocked(data.conversation.is_blocked || false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading chat";
      setError(msg);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  useEffect(() => {
    if (convId) {
      fetchChat();
    }
  }, [convId]);

  // Supabase Realtime for instant incoming messages
  useEffect(() => {
    if (!convId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        (payload: any) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Check if already in messages (e.g. from optimistic update)
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(scrollToBottom, 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [convId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending || isBlocked) return;

    setInputText("");
    setSending(true);

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: convId,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: convId,
          body: text,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      // Replace optimistic message with confirmed message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data.message : m))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error sending";
      setError(msg);
      // Remove optimistic on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleBlockUser = async () => {
    if (!conversation?.other_user?.id) return;
    setBlocking(true);
    try {
      if (isBlocked) {
        await fetch("/api/blocks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocked_id: conversation.other_user.id }),
        });
        setIsBlocked(false);
      } else {
        await fetch("/api/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocked_id: conversation.other_user.id }),
        });
        setIsBlocked(true);
      }
      setIsMenuOpen(false);
    } catch {
      setError("Failed to update block status");
    } finally {
      setBlocking(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim() || !conversation?.other_user?.id) return;
    setReporting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "USER",
          target_id: conversation.other_user.id,
          reason: reportReason.trim(),
        }),
      });
      if (res.ok) {
        setShowReportModal(false);
        setReportReason("");
        setIsMenuOpen(false);
        alert("Report submitted. Campus safety moderators will review it.");
      }
    } catch {
      setError("Failed to submit report");
    } finally {
      setReporting(false);
    }
  };

  const otherUser = conversation?.other_user;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-2" />
        <p className="text-xs text-slate-400">Opening chat...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100dvh-4rem)] max-w-lg mx-auto w-full bg-[#090D16]">
      {/* Chat Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/messages"
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-white truncate max-w-[160px]">
                {otherUser?.name || "Student"}
              </h2>
              {otherUser?.verification_status === "APPROVED" && (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
              {otherUser?.college || "Campus Member"}
            </p>
          </div>
        </div>

        {/* 3-dots Menu */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Chat options"
            className="w-10 h-10 rounded-full text-slate-400 hover:text-white flex items-center justify-center min-h-[44px] min-w-[44px]"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-12 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-30 animate-fade-in text-xs">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowReportModal(true);
                }}
                className="w-full text-left px-3 py-2 text-rose-400 hover:bg-slate-800 rounded-lg flex items-center gap-2 min-h-[44px]"
              >
                <ShieldAlert className="w-4 h-4" />
                Report Student
              </button>
              <button
                onClick={handleBlockUser}
                disabled={blocking}
                className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-lg flex items-center gap-2 min-h-[44px]"
              >
                <UserX className="w-4 h-4" />
                {isBlocked ? "Unblock Student" : "Block Student"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Listing Link Header banner */}
      {conversation?.listing && (
        <div className="px-4 py-2 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-400 truncate max-w-[240px]">
            Item: <strong className="text-white">{conversation.listing.title}</strong>
          </span>
          <Link
            href={`/listing/${conversation.listing.id}`}
            className="text-brand-teal font-semibold hover:underline text-[11px]"
          >
            View Listing
          </Link>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            Start your chat with {otherUser?.name || "the student"}! Ask about item pickup time, condition, or location.
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
                    isMe
                      ? "bg-brand-teal text-slate-950 font-medium rounded-tr-sm"
                      : "bg-slate-800 text-white rounded-tl-sm"
                  }`}
                >
                  {m.body}
                </div>
                <div className="flex items-center gap-1 mt-1 px-1">
                  <span className="text-[10px] text-slate-500">
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isMe && (
                    m.read_at ? (
                      <CheckCheck className="w-3 h-3 text-brand-teal" />
                    ) : (
                      <Check className="w-3 h-3 text-slate-500" />
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      {isBlocked ? (
        <div className="p-4 bg-slate-900 border-t border-slate-800 text-center text-xs text-rose-400 shrink-0">
          You have blocked or have been blocked by this user.
        </div>
      ) : (
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          <input
            type="text"
            required
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal min-h-[44px]"
          />
          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            aria-label="Send message"
            className="w-12 h-12 rounded-2xl bg-brand-teal text-slate-950 flex items-center justify-center hover:bg-brand-teal-light transition shadow min-h-[44px] min-w-[44px] disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Report User</h3>
            <p className="text-xs text-slate-400 mb-3">
              Help keep our student campus platform safe. Describe the issue:
            </p>
            <form onSubmit={handleReport} className="space-y-3">
              <textarea
                rows={3}
                required
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Inappropriate message, spam, harassment..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-base focus:outline-none focus:border-rose-500 min-h-[44px] resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-xs min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reporting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition min-h-[44px] disabled:opacity-50"
                >
                  {reporting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
