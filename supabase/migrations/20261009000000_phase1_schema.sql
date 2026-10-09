-- Phase 1 Schema Migration for RENTIQ

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  college TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  profile_photo_url TEXT DEFAULT NULL,
  verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    verification_status IN ('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'MANUAL_REVIEW', 'RESUBMISSION_REQUIRED')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (
    role IN ('customer', 'owner', 'delivery_partner', 'admin', 'super_admin')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- 3. Public view for limited profile access by non-owners
CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT
  id,
  name,
  college,
  profile_photo_url,
  verification_status
FROM public.profiles;

-- 4. Function and Trigger to handle auto profile & roles creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  );

  -- Assign default roles: customer and owner
  INSERT INTO public.user_roles (user_id, role)
  VALUES 
    (NEW.id, 'customer'),
    (NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Trigger to prevent users from updating verification_status directly on profiles
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Prevent changing verification_status unless updated by service_role
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
      NEW.verification_status := OLD.verification_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- 6. Row Level Security (RLS) setup

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own full profile
CREATE POLICY "Users can read own full profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (protected fields handled by trigger)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- User roles RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own assigned roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Direct Insert/Update/Delete on user_roles denied for regular users by default (no INSERT/UPDATE/DELETE policies given to authenticated users)

-- 7. Storage Bucket and RLS for profile-photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public can view profile photos
CREATE POLICY "Profile photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

-- Authenticated users can upload to their own user folder (bucket_id/user_id/*)
CREATE POLICY "Users can upload profile photos to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update/delete their own profile photos
CREATE POLICY "Users can update own profile photo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own profile photo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );
