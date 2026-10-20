-- Phase 5 Batch C: Contact, Renter Pickup Note, and Zone-Based Print Matching Migration
--
-- Rules and Features Enforced:
-- 1. Listing contact fields:
--    - Adds owner_phone text and share_phone boolean NOT NULL DEFAULT false to listings.
--    - Enforces CHECK on owner_phone: NULL or valid Indian mobile ^(\+91)?[6-9][0-9]{9}$.
--    - Enforces CHECK on share_phone: share_phone = false OR owner_phone IS NOT NULL.
--    - BEFORE UPDATE trigger on listings (tr_protect_listing_contact) blocks non-owners
--      from changing owner_phone or share_phone (auth.uid() = OLD.owner_id or service_role).
-- 2. Contact reveal logging and function:
--    - contact_views table: id, listing_id (cascade), viewer_id (cascade), created_at.
--    - RLS enabled with no client policies (access only via SECURITY DEFINER function or service_role).
--    - get_listing_contact(p_listing_id uuid) returns text: requires auth.uid(), requires ACTIVE listing,
--      returns NULL if share_phone is false, rejects owner callers, logs view in contact_views, returns owner_phone.
--    - Permissions: revoked from PUBLIC and anon, granted to authenticated.
-- 3. Renter pickup note on rentals:
--    - Adds pickup_note text to rentals with length between 3 and 200 chars.
--    - Pickup note validated by Zod on server; fn_validate_and_snapshot_rental not replaced.
--    - fn_lock_rental_pickup_note BEFORE UPDATE trigger raises 'pickup_note is locked after the request is created'.
-- 4. Partner zones:
--    - Adds zones text[] NOT NULL DEFAULT '{}' to partner_profiles.
--    - Updates fn_protect_partner_profiles allowing partners to update zones (along with is_online, radius_km, updated_at).
--    - Adds pickup_zone text NOT NULL DEFAULT 'DEFAULT' (length 2-60) to print_orders without altering existing data.
-- 5. Print job creation and matching:
--    - create_print_job(p_order_id uuid) returns uuid: SECURITY DEFINER, only customer or service_role allowed.
--    - Inserts print_jobs row ('SEARCHING_PARTNER') and print_job_offers ('OFFERED') for approved, online partners matching pickup_zone.
--    - Returns existing job id if already created.
--    - Permissions: revoked from PUBLIC and anon, granted to authenticated.
-- 6. Print job status transitions enforced:
--    - tr_enforce_print_job_status BEFORE UPDATE OF status trigger on print_jobs.
--    - Enforces jobStatus.ts partner transitions requiring auth.uid() = NEW.partner_id.
--    - Enforces SEARCHING_PARTNER to NO_PARTNER_FOUND (service_role only).
--    - Enforces CANCELLED before PICKED_UP (order customer or service_role only).
--    - Raises 'Invalid print job transition from % to %' on any violation.

-- ==============================================================================
-- 1. LISTING CONTACT FIELDS
-- ==============================================================================

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS share_phone boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_owner_phone'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_owner_phone
      CHECK (owner_phone IS NULL OR owner_phone ~ '^(\+91)?[6-9][0-9]{9}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_share_phone'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_share_phone
      CHECK (share_phone = false OR owner_phone IS NOT NULL);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_protect_listing_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role BOOLEAN;
BEGIN
  v_is_service_role := (auth.role() = 'service_role');

  IF (NEW.owner_phone IS DISTINCT FROM OLD.owner_phone OR NEW.share_phone IS DISTINCT FROM OLD.share_phone) THEN
    IF NOT (v_is_service_role OR (auth.uid() IS NOT NULL AND auth.uid() = OLD.owner_id)) THEN
      RAISE EXCEPTION 'Only the listing owner can update owner_phone or share_phone';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_listing_contact ON public.listings;
CREATE TRIGGER tr_protect_listing_contact
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_listing_contact();

-- ==============================================================================
-- 2. CONTACT REVEAL LOGGING AND FUNCTION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.contact_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_views_listing_id ON public.contact_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_contact_views_viewer_id ON public.contact_views(viewer_id);

ALTER TABLE public.contact_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_listing_contact(p_listing_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_listing public.listings%ROWTYPE;
BEGIN
  -- Step 1: require auth.uid()
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Step 2: require the listing to be ACTIVE
  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id;
  IF NOT FOUND OR v_listing.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Listing is not active';
  END IF;

  -- Step 3: return NULL if share_phone is false
  IF NOT coalesce(v_listing.share_phone, false) THEN
    RETURN NULL;
  END IF;

  -- Step 4: reject if the caller is the owner
  IF v_caller_id = v_listing.owner_id THEN
    RAISE EXCEPTION 'Caller cannot be the owner of the listing';
  END IF;

  -- Step 5: insert a contact_views row
  INSERT INTO public.contact_views (listing_id, viewer_id)
  VALUES (p_listing_id, v_caller_id);

  -- Step 6: return owner_phone
  RETURN v_listing.owner_phone;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_listing_contact(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_listing_contact(UUID) TO authenticated;

-- ==============================================================================
-- 3. RENTER PICKUP NOTE ON RENTALS
-- ==============================================================================

ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS pickup_note text CHECK (pickup_note IS NULL OR char_length(pickup_note) BETWEEN 3 AND 200);

-- Note: fn_validate_and_snapshot_rental is intentionally not replaced here.
-- The pickup note is validated by Zod on the server.

CREATE OR REPLACE FUNCTION public.fn_lock_rental_pickup_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pickup_note IS DISTINCT FROM OLD.pickup_note THEN
    RAISE EXCEPTION 'pickup_note is locked after the request is created';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_lock_rental_pickup_note ON public.rentals;
CREATE TRIGGER tr_lock_rental_pickup_note
  BEFORE UPDATE ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_lock_rental_pickup_note();

-- ==============================================================================
-- 4. PARTNER ZONES
-- ==============================================================================

ALTER TABLE public.partner_profiles
  ADD COLUMN IF NOT EXISTS zones text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.fn_protect_partner_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_service_role BOOLEAN;
BEGIN
  v_is_service_role := (auth.role() = 'service_role');

  IF TG_OP = 'UPDATE' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    ) INTO v_is_admin;

    IF NOT (v_is_service_role OR coalesce(v_is_admin, false)) THEN
      IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'user_id cannot be changed';
      END IF;

      IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
        RAISE EXCEPTION 'Only the server or an admin sets is_approved';
      END IF;

      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'created_at cannot be changed';
      END IF;

      IF (to_jsonb(NEW) - 'is_online' - 'radius_km' - 'zones' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'is_online' - 'radius_km' - 'zones' - 'updated_at') THEN
        RAISE EXCEPTION 'Partners can only update is_online, radius_km and zones';
      END IF;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    ) INTO v_is_admin;

    IF NOT (v_is_service_role OR coalesce(v_is_admin, false)) THEN
      NEW.is_online := false;
      NEW.is_approved := false;
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

ALTER TABLE public.print_orders
  ADD COLUMN IF NOT EXISTS pickup_zone text NOT NULL DEFAULT 'DEFAULT' CHECK (char_length(pickup_zone) BETWEEN 2 AND 60);

-- ==============================================================================
-- 5. PRINT JOB CREATION AND MATCHING
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_print_job(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_service_role BOOLEAN;
  v_order public.print_orders%ROWTYPE;
  v_existing_job_id UUID;
  v_job_id UUID;
BEGIN
  v_caller_id := auth.uid();
  v_is_service_role := (auth.role() = 'service_role');

  -- Fetch order
  SELECT * INTO v_order FROM public.print_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Print order not found';
  END IF;

  -- Only the order's customer or service_role may call it
  IF NOT (v_is_service_role OR (v_caller_id IS NOT NULL AND v_caller_id = v_order.customer_id)) THEN
    RAISE EXCEPTION 'Only the order customer or service_role may create a print job';
  END IF;

  -- If the job already exists, return its id and do nothing
  SELECT id INTO v_existing_job_id FROM public.print_jobs WHERE order_id = p_order_id;
  IF v_existing_job_id IS NOT NULL THEN
    RETURN v_existing_job_id;
  END IF;

  -- Insert print_jobs row (status 'SEARCHING_PARTNER')
  INSERT INTO public.print_jobs (order_id, status)
  VALUES (p_order_id, 'SEARCHING_PARTNER')
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN
    SELECT id INTO v_job_id FROM public.print_jobs WHERE order_id = p_order_id;
    RETURN v_job_id;
  END IF;

  -- Insert one print_job_offers row (status 'OFFERED') for each partner in partner_profiles
  -- where is_approved = true AND is_online = true AND the order's pickup_zone is in zones
  INSERT INTO public.print_job_offers (job_id, partner_id, status)
  SELECT v_job_id, pp.user_id, 'OFFERED'
  FROM public.partner_profiles pp
  WHERE pp.is_approved = true
    AND pp.is_online = true
    AND EXISTS (
      SELECT 1
      FROM unnest(pp.zones) AS z
      WHERE lower(trim(z)) = lower(trim(v_order.pickup_zone))
    )
  ON CONFLICT (job_id, partner_id) DO NOTHING;

  RETURN v_job_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_print_job(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_print_job(UUID) TO authenticated;

-- ==============================================================================
-- 6. PRINT JOB STATUS TRANSITIONS ENFORCED IN THE DATABASE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_enforce_print_job_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_service_role BOOLEAN;
  v_customer_id UUID;
BEGIN
  -- If status did not change, allow update
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_caller_id := auth.uid();
  v_is_service_role := (auth.role() = 'service_role');

  -- 1. SEARCHING_PARTNER to NO_PARTNER_FOUND (service_role only)
  IF OLD.status = 'SEARCHING_PARTNER' AND NEW.status = 'NO_PARTNER_FOUND' THEN
    IF v_is_service_role THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Invalid print job transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  -- 2. CANCELLED from any state before PICKED_UP (customer of the order or service_role)
  IF NEW.status = 'CANCELLED' AND OLD.status IN ('SEARCHING_PARTNER', 'ACCEPTED', 'AT_SHOP', 'PRINTING') THEN
    IF v_is_service_role THEN
      RETURN NEW;
    END IF;

    SELECT customer_id INTO v_customer_id FROM public.print_orders WHERE id = NEW.order_id;
    IF v_caller_id IS NOT NULL AND v_caller_id = v_customer_id THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Invalid print job transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  -- 3. Partner transitions from src/lib/partner/jobStatus.ts (requires auth.uid() = NEW.partner_id)
  IF (
    (OLD.status = 'SEARCHING_PARTNER' AND NEW.status = 'ACCEPTED') OR
    (OLD.status = 'ACCEPTED' AND NEW.status = 'AT_SHOP') OR
    (OLD.status = 'AT_SHOP' AND NEW.status = 'PRINTING') OR
    (OLD.status = 'PRINTING' AND NEW.status = 'PICKED_UP') OR
    (OLD.status = 'PICKED_UP' AND NEW.status = 'IN_TRANSIT') OR
    (OLD.status = 'IN_TRANSIT' AND NEW.status = 'ARRIVED_AT_DROP') OR
    (OLD.status = 'ARRIVED_AT_DROP' AND NEW.status = 'DELIVERED') OR
    (OLD.status = 'DELIVERED' AND NEW.status = 'COMPLETED')
  ) THEN
    IF v_is_service_role OR (v_caller_id IS NOT NULL AND NEW.partner_id IS NOT NULL AND v_caller_id = NEW.partner_id) THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Invalid print job transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  -- 4. Anything else
  RAISE EXCEPTION 'Invalid print job transition from % to %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_print_job_status ON public.print_jobs;
CREATE TRIGGER tr_enforce_print_job_status
  BEFORE UPDATE OF status ON public.print_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enforce_print_job_status();
