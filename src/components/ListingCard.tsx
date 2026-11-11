"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Listing } from "@/types";
import FavoriteButton from "@/components/FavoriteButton";

export default function ListingCard({ listing }: { listing: Listing }) {
  const router = useRouter();

  const handleClick = () => router.push(`/listing/${listing.id}`);

  const sortedPhotos = listing.listing_photos
    ? [...listing.listing_photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : [];
  const primaryStoragePath = sortedPhotos[0]?.storage_path;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mdyvponmttlgyitzfbto.supabase.co";

  const resolvedCoverUrl = listing.coverPhotoUrl
    ? listing.coverPhotoUrl
    : primaryStoragePath
    ? primaryStoragePath.startsWith("http")
      ? primaryStoragePath
      : `${supabaseUrl}/storage/v1/object/public/listing-photos/${primaryStoragePath}`
    : null;

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col active:scale-[0.98] transition-transform"
    >
      <div className="relative w-full aspect-square bg-slate-800">
        {resolvedCoverUrl ? (
          <Image
            src={resolvedCoverUrl}
            alt={listing.title}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-500">
            No photo
          </div>
        )}

        <div
          className="absolute top-1.5 right-1.5 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <FavoriteButton listingId={listing.id} />
        </div>

        {listing.delivery_available && (
          <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide bg-slate-950/80 text-brand-teal px-1.5 py-0.5 rounded">
            Delivery
          </span>
        )}
      </div>

      <div className="p-2 flex flex-col flex-1">
        <h3 className="text-[12.5px] font-medium text-white leading-snug line-clamp-2 min-h-[32px]">
          {listing.title}
        </h3>

        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-[15px] font-bold text-white">₹{listing.price_per_day}</span>
          <span className="text-[10px] text-slate-400">/day</span>
        </div>

        <p className="text-[10px] text-slate-500 mt-0.5 truncate">
          {String(listing.condition).replace("_", " ").toLowerCase()}
          {listing.college ? `  ${listing.college}` : ""}
        </p>
      </div>
    </div>
  );
}
