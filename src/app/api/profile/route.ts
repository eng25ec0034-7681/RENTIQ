import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/lib/validations";
import { partnerZonesSchema } from "@/lib/validation/contactSchema";
import { devStore } from "@/lib/supabase/dev-store";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-rentiq.supabase.co";
    const isPlaceholder = supabaseUrl.includes("placeholder");

    const devUserId = request.cookies.get("rentiq_user_id")?.value;

    if (isPlaceholder || devUserId) {
      if (!devUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const user = await devStore.getUserById(devUserId);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const profile = await devStore.getProfile(devUserId);
      const roles = await devStore.getRoles(devUserId);

      return NextResponse.json({ profile, roles, userEmail: user.email });
    }

    try {
      const supabase: any = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (rolesError) {
        return NextResponse.json({ error: rolesError.message }, { status: 500 });
      }

      const roles = rolesData ? rolesData.map((r: any) => r.role) : [];

      return NextResponse.json({ profile, roles, userEmail: user.email });
    } catch {
      if (!devUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const user = await devStore.getUserById(devUserId);
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const profile = await devStore.getProfile(devUserId);
      const roles = await devStore.getRoles(devUserId);
      return NextResponse.json({ profile, roles, userEmail: user.email });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-rentiq.supabase.co";
    const isPlaceholder = supabaseUrl.includes("placeholder");
    const devUserId = request.cookies.get("rentiq_user_id")?.value;

    const body = await request.json();

    // Prevent direct manipulation of protected fields
    delete body.verification_status;
    delete body.roles;
    delete body.id;

    if (body.zones !== undefined) {
      const zonesValidation = partnerZonesSchema.safeParse(body.zones);
      if (!zonesValidation.success) {
        return NextResponse.json(
          { error: zonesValidation.error.errors[0]?.message || "Invalid partner zones" },
          { status: 400 }
        );
      }
    }

    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, college, department, year, bio } = validation.data;

    if (isPlaceholder || devUserId) {
      if (!devUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const updatedProfile = await devStore.updateProfile(devUserId, {
        name,
        college,
        department,
        year,
        bio,
      });
      return NextResponse.json({ profile: updatedProfile });
    }

    try {
      const supabase: any = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update({
          name,
          college,
          department,
          year,
          bio,
        })
        .eq("id", user.id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (body.zones !== undefined) {
        const zonesValidation = partnerZonesSchema.safeParse(body.zones);
        if (zonesValidation.success) {
          const { data: existingPartner } = await supabase
            .from("partner_profiles")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (!existingPartner) {
            return NextResponse.json(
              { error: "Only approved student partners can set zones" },
              { status: 403 }
            );
          }

          const { error: updatePartnerErr } = await supabase
            .from("partner_profiles")
            .update({ zones: zonesValidation.data })
            .eq("user_id", user.id);

          if (updatePartnerErr) {
            return NextResponse.json(
              { error: "Could not save partner zones" },
              { status: 500 }
            );
          }
        }
      }

      return NextResponse.json({ profile: updatedProfile });
    } catch {
      if (!devUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const updatedProfile = await devStore.updateProfile(devUserId, {
        name,
        college,
        department,
        year,
        bio,
      });
      return NextResponse.json({ profile: updatedProfile });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
