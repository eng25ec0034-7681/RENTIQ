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
      className="cursor-pointer rounded-lg bg-neutral-900 p-2 hover:shadow-md transition-shadow relative group"
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
            className="rounded w-full object-cover h-48"
          />
        ) : (
          <div className="h-48 bg-neutral-800 flex items-center justify-center text-gray-500">
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
      <h3 className="mt-2 text-lg font-medium text-white truncate" title={listing.title}>
        {listing.title}
      </h3>
      <p className="text-teal-400">₹{listing.price_per_day}/day</p>
      <div className="flex items-center space-x-2 mt-1">
        <span className="px-2 py-0.5 rounded bg-teal-600 text-xs text-white">
          {listing.condition}
        </span>
        {listing.college && (
          <span className="text-sm text-gray-300">{listing.college}</span>
        )}
        {listing.delivery_available && (
          <span className="text-xs bg-green-600 text-white rounded px-1">Delivery</span>
        )}
      </div>
    </div>
  );
}
