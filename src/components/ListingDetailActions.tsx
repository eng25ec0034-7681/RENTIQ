"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Calendar, Loader2 } from "lucide-react";
import { RentalRequestModal } from "@/components/RentalRequestModal";

interface ListingDetailActionsProps {
  listing: {
    id: string;
    title: string;
    price_per_day: number;
    max_rental_days?: number;
    delivery_available: boolean;
    pickup_available: boolean;
    pickup_zone?: string;
  };
  isOwner: boolean;
}

export function ListingDetailActions({ listing, isOwner }: ListingDetailActionsProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  if (isOwner) {
    return (
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <p className="text-xs text-slate-400">
          This is your listing. Manage or edit it in{" "}
          <button
            onClick={() => router.push("/my-listings")}
            className="text-brand-teal font-semibold hover:underline"
          >
            My Listings
          </button>
          .
        </p>
      </div>
    );
  }

  const handleContactOwner = async () => {
    setLoadingChat(true);
    setChatError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listing.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start conversation");
      }

      router.push(`/messages/${data.conversation_id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting owner";
      setChatError(msg);
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <div className="space-y-3">
      {chatError && (
        <p className="text-xs text-red-400 text-center">{chatError}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleContactOwner}
          disabled={loadingChat}
          className="py-3 px-4 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:text-white hover:bg-slate-800 font-semibold text-sm flex items-center justify-center gap-2 transition min-h-[44px] disabled:opacity-50"
        >
          {loadingChat ? (
            <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
          ) : (
            <MessageSquare className="w-4 h-4 text-brand-teal" />
          )}
          Contact Owner
        </button>

        <button
          onClick={() => setIsModalOpen(true)}
          className="py-3 px-4 rounded-xl bg-brand-teal text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-teal/20 hover:bg-brand-teal-light transition min-h-[44px]"
        >
          <Calendar className="w-4 h-4" />
          Rent This
        </button>
      </div>

      <RentalRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        listing={listing}
      />
    </div>
  );
}
