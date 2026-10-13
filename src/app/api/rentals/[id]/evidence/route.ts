import { NextResponse } from "next/server";
import { createClient, getUserOrThrow } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per photo

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rentalId } = await params;
    const user = await getUserOrThrow();

    const supabase = await createClient();

    // Verify user is a participant of this rental
    const { data: rental, error: fetchErr } = await supabase
      .from("rentals")
      .select("id, renter_id, owner_id")
      .eq("id", rentalId)
      .single();

    if (fetchErr || !rental) {
      return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    }

    if (rental.renter_id !== user.id && rental.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const formData = await request.formData();
    const type = formData.get("type") as string; // "HANDOVER" | "RETURN"
    const condition_notes = formData.get("condition_notes") as string | null;
    const damage_notes = formData.get("damage_notes") as string | null;

    if (type !== "HANDOVER" && type !== "RETURN") {
      return NextResponse.json({ error: "Invalid evidence type. Must be HANDOVER or RETURN" }, { status: 400 });
    }

    const files = formData.getAll("photos") as File[];
    if (files.length > 6) {
      return NextResponse.json({ error: "Maximum of 6 photos allowed" }, { status: 400 });
    }

    const photoPaths: string[] = [];
    const signedUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `File ${file.name} has an invalid type. Only JPG, PNG, and WebP are allowed.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds the 5MB size limit.` },
          { status: 400 }
        );
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${rentalId}/${type.toLowerCase()}_${Date.now()}_${i}.${ext}`;

      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadErr } = await supabase.storage
        .from("rental-evidence")
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadErr) {
        return NextResponse.json({ error: `Failed to upload photo: ${uploadErr.message}` }, { status: 500 });
      }

      photoPaths.push(filePath);

      const { data: signedData } = await supabase.storage
        .from("rental-evidence")
        .createSignedUrl(filePath, 3600);

      if (signedData?.signedUrl) {
        signedUrls.push(signedData.signedUrl);
      }
    }

    // Insert record in rental_evidence
    const { data: evidenceRecord, error: insertErr } = await supabase
      .from("rental_evidence")
      .insert({
        rental_id: rentalId,
        type,
        photo_paths: photoPaths,
        condition_notes: condition_notes?.trim() || null,
        damage_notes: damage_notes?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        evidence: {
          ...evidenceRecord,
          signed_photo_urls: signedUrls,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("authenticated") ? 401 : 500 });
  }
}
