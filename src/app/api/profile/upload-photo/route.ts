import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/validations";
import { handleSupabaseError } from "@/lib/supabase/error-handler";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // SERVER-SIDE VALIDATION: File Type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPG, PNG, and WebP images are allowed." },
        { status: 400 }
      );
    }

    // SERVER-SIDE VALIDATION: File Size (2MB max)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 2 MB limit." },
        { status: 400 }
      );
    }

    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage bucket 'profile-photos'
    const { data: storageData, error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(storageData.path);

    const profilePhotoUrl = publicUrlData.publicUrl;

    // Update profile with photo URL
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({ profile_photo_url: profilePhotoUrl })
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Profile photo uploaded successfully",
      profile_photo_url: profilePhotoUrl,
      profile: updatedProfile,
    });
  } catch (err: unknown) {
    return handleSupabaseError(err);
  }
}
