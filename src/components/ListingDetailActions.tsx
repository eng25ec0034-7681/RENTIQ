"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, Phone } from "lucide-react";
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
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [loadingContact, setLoadingContact] = useState(false);
  const [contactMessage, setContactMessage] = useState<string | null>(null);

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
    setLoadingContact(true);
    setContactMessage(null);
    try {
      const res = await fetch(`/api/listings/${listing.id}/contact`, {
        method: "POST",
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reveal contact");
      }

      setPhone(data.phone ?? null);
      if (data.phone === null || data.phone === undefined) {
        setContactMessage("Owner has not shared a number");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting owner";
      setContactMessage(msg);
    } finally {
      setLoadingContact(false);
    }
  };

  return (
    <div className="space-y-3">
      {contactMessage && (
        <p className="text-xs text-amber-400 text-center font-medium bg-amber-500/10 border border-amber-500/20 py-2 px-3 rounded-xl">
          {contactMessage}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="py-3 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold text-sm flex items-center justify-center gap-2 transition min-h-[44px]"
          >
            <Phone className="w-4 h-4" />
            <span>{phone}</span>
          </a>
        ) : (
          <button
            onClick={handleContactOwner}
            disabled={loadingContact}
            className="py-3 px-4 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:text-white hover:bg-slate-800 font-semibold text-sm flex items-center justify-center gap-2 transition min-h-[44px] disabled:opacity-50"
          >
            {loadingContact ? (
              <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
            ) : (
              <Phone className="w-4 h-4 text-brand-teal" />
            )}
            Contact Owner
          </button>
        )}

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
