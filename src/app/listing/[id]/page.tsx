import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, MapPin, Building, ShieldCheck, Truck, Package } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import FavoriteButton from "@/components/FavoriteButton";
import { ListingDetailActions } from "@/components/ListingDetailActions";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Fetch listing with photos and owner public profile
  const { data: listing, error } = await supabase
    .from("listings")
    .select(`
      id, title, category, description, condition, price_per_day, max_rental_days,
      college, pickup_zone, delivery_available, pickup_available, rules, status, owner_id,
      listing_photos(storage_path, position),
      owner:profiles!listings_owner_id_fkey(id, name, college, profile_photo_url, verification_status)
    `)
    .eq("id", id)
    .single();

  if (error || !listing) {
    notFound();
  }

  // Get current user to check ownership
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = user?.id === listing.owner_id;

  // Resolve photos
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mdyvponmttlgyitzfbto.supabase.co";
  const sortedPhotos = (listing.listing_photos || []).sort(
    (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
  );

  const photoUrls = sortedPhotos.map((p: any) =>
    p.storage_path.startsWith("http")
      ? p.storage_path
      : `${supabaseUrl}/storage/v1/object/public/listing-photos/${p.storage_path}`
  );

  const ownerProfile = Array.isArray(listing.owner) ? listing.owner[0] : listing.owner;

  return (
    <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
      {/* Back bar */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition py-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Listings
        </Link>
        <FavoriteButton listingId={listing.id} />
      </div>

      {/* Photo Gallery */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 mb-5">
        {photoUrls.length > 0 ? (
          <div className="relative w-full h-72 overflow-hidden">
            <Image
              src={photoUrls[0]}
              alt={listing.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-600">
            <Package className="w-12 h-12 mb-2" />
            <span className="text-xs">No photos available</span>
          </div>
        )}

        {photoUrls.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto bg-slate-950/80">
            {photoUrls.map((url: string, index: number) => (
              <div
                key={index}
                className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-slate-700"
              >
                <Image src={url} alt={`Thumbnail ${index + 1}`} fill className="object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Details */}
      <div className="space-y-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-brand-teal text-xs font-bold uppercase tracking-wider">
              {listing.category}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
              {listing.condition}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{listing.title}</h1>
          <p className="text-xl font-bold text-brand-teal mt-1">₹{listing.price_per_day} <span className="text-xs text-slate-400 font-normal">/ day</span></p>
        </div>

        {/* Location & Delivery Info */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
          {listing.college && (
            <div className="flex items-center gap-2 text-slate-300">
              <Building className="w-4 h-4 text-brand-teal shrink-0" />
              <span>Campus: <strong className="text-white">{listing.college}</strong></span>
            </div>
          )}
          {listing.pickup_zone && (
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-brand-teal shrink-0" />
              <span>Pickup Spot: <strong className="text-white">{listing.pickup_zone}</strong></span>
            </div>
          )}
          <div className="flex items-center gap-3 pt-1 border-t border-slate-800 text-[11px]">
            {listing.pickup_available && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Self Pickup
              </span>
            )}
            {listing.delivery_available && (
              <span className="flex items-center gap-1 text-blue-400">
                <Truck className="w-3.5 h-3.5" /> Campus Delivery
              </span>
            )}
            {listing.max_rental_days && (
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3.5 h-3.5" /> Max {listing.max_rental_days} days
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description</h2>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line bg-slate-900/50 p-3.5 rounded-2xl border border-slate-800/80">
            {listing.description || "No description provided."}
          </p>
        </div>

        {/* Rules */}
        {listing.rules && (
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Owner Rules</h2>
            <p className="text-xs text-slate-300 bg-slate-900/50 p-3.5 rounded-2xl border border-slate-800/80">
              {listing.rules}
            </p>
          </div>
        )}

        {/* Owner Public Profile */}
        {ownerProfile && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                {ownerProfile.profile_photo_url ? (
                  // eslint-disable-next-next/no-img-element
                  <img
                    src={ownerProfile.profile_photo_url}
                    alt={ownerProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-base font-bold text-brand-teal">
                    {ownerProfile.name?.charAt(0) || "U"}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{ownerProfile.name}</h3>
                <p className="text-xs text-slate-400">{ownerProfile.college || "Campus Student"}</p>
              </div>
            </div>
            {ownerProfile.verification_status === "APPROVED" && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified
              </span>
            )}
          </div>
        )}

        {/* Action Buttons: Contact Owner & Rent This */}
        <ListingDetailActions
          listing={{
            id: listing.id,
            title: listing.title,
            price_per_day: listing.price_per_day,
            max_rental_days: listing.max_rental_days,
            delivery_available: listing.delivery_available,
            pickup_available: listing.pickup_available,
            pickup_zone: listing.pickup_zone,
          }}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
