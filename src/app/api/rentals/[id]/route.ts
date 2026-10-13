import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserOrThrow();

    const supabase = await createClient();

    const { data: rental, error } = await supabase
      .from("rentals")
      .select(`
        *,
        listing:listings(
          id, title, category, price_per_day, college, pickup_zone, rules,
          delivery_available, pickup_available, listing_photos(storage_path, position)
        ),
        renter:profiles!rentals_renter_id_fkey(id, name, college, profile_photo_url, verification_status),
        owner:profiles!rentals_owner_id_fkey(id, name, college, profile_photo_url, verification_status),
        status_events:rental_status_events(id, from_status, to_status, changed_by, note, created_at),
        evidence:rental_evidence(id, type, photo_paths, condition_notes, damage_notes, created_by, created_at)
      `)
      .eq("id", id)
      .single();

    if (error || !rental) {
      return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    }

    // IDOR protection: only participants can view
    if (rental.renter_id !== user.id && rental.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Generate signed URLs for private rental evidence photos
    if (rental.evidence && Array.isArray(rental.evidence)) {
      for (const ev of rental.evidence) {
        if (ev.photo_paths && ev.photo_paths.length > 0) {
          const signedUrls: string[] = [];
          for (const path of ev.photo_paths) {
            const { data: signedData } = await supabase.storage
              .from("rental-evidence")
              .createSignedUrl(path, 3600); // 1 hour validity
            if (signedData?.signedUrl) {
              signedUrls.push(signedData.signedUrl);
            }
          }
          ev.signed_photo_urls = signedUrls;
        } else {
          ev.signed_photo_urls = [];
        }
      }
    }

    // Sort status events chronologically
    if (rental.status_events && Array.isArray(rental.status_events)) {
      rental.status_events.sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    return NextResponse.json({
      rental,
      userRole: user.id === rental.owner_id ? "owner" : "renter",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}
