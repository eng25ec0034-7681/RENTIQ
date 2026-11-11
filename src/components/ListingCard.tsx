"use client";

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Listing } from '@/types';
import FavoriteButton from '@/components/FavoriteButton';

export default function ListingCard({ listing }: { listing: Listing }) {
  const router = useRouter();

  const handleClick = () => router.push(`/listing/${listing.id}`);

  // Sort listing_photos by position ascending and pick the first one as cover
  const sortedPhotos = listing.listing_photos
    ? [...listing.listing_photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : [];
  const primaryStoragePath = sortedPhotos[0]?.storage_path;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mdyvponmttlgyitzfbto.supabase.co";

  const resolvedCoverUrl = listing.coverPhotoUrl
    ? listing.coverPhotoUrl
    : primaryStoragePath
    ? (primaryStoragePath.startsWith("http")
        ? primaryStoragePath
        : `${supabaseUrl}/storage/v1/object/public/listing-photos/${primaryStoragePath}`)
    : null;

  return (
    <div
      className="cursor-pointer rounded-2xl bg-slate-900 border border-slate-800 p-2.5 hover:border-slate-700 transition-colors relative group"
      onClick={handleClick}
    >
      {/* Cover photo – fallback to placeholder if missing */}
      <div className="relative w-full overflow-hidden rounded">
        {resolvedCoverUrl ? (
          <Image
            src={resolvedCoverUrl}
            alt={listing.title}
            width={300}
            height={200}
            className="rounded w-full object-cover h-[40vh] max-h-[340px]"
          />
        ) : (
          <div className="h-[40vh] max-h-[340px] bg-neutral-800 flex items-center justify-center text-gray-500">
            No image
          </div>
        )}
        <div
          className="absolute top-2 right-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <FavoriteButton listingId={listing.id} />
        </div>
      </div>
      <h3 className="mt-2 text-base font-semibold text-white truncate" title={listing.title}>
        {listing.title}
      </h3>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-lg font-bold text-white">₹{listing.price_per_day}</span>
        <span className="text-xs text-slate-400">/day</span>
        {listing.max_rental_days ? (
          <span className="text-xs text-slate-500 ml-auto">up to {listing.max_rental_days}d</span>
        ) : null}
      </div>
      <div className="flex items-center space-x-2 mt-1">
        <span className="px-2 py-0.5 rounded-md bg-brand-teal/15 text-brand-teal border border-brand-teal/30 text-[11px] font-semibold capitalize">
          {listing.condition}
        </span>
        {listing.college && (
          <span className="text-xs text-slate-400">{listing.college}</span>
        )}
        {listing.delivery_available && (
          <span className="text-[11px] bg-slate-800 text-slate-300 border border-slate-700 rounded px-1.5 py-0.5">Delivery</span>
        )}
      </div>
    </div>
  );
}
