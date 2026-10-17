-- Phase 5 Batch B: Student-Partner Print Jobs Migration
-- Note: Offers and transitions are enforced in later batches.

-- 1. Create partner_profiles table
CREATE TABLE IF NOT EXISTS public.partner_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_online BOOLEAN NOT NULL DEFAULT false,
  radius_km INT NOT NULL DEFAULT 2 CHECK (radius_km BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_profiles_user_id ON public.partner_profiles(user_id);

-- Trigger to protect partner_profiles: only server or admin sets is_approved
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

      IF (to_jsonb(NEW) - 'is_online' - 'radius_km' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'is_online' - 'radius_km' - 'updated_at') THEN
        RAISE EXCEPTION 'Partners can only update is_online and radius_km';
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

DROP TRIGGER IF EXISTS tr_protect_partner_profiles ON public.partner_profiles;
CREATE TRIGGER tr_protect_partner_profiles
  BEFORE INSERT OR UPDATE ON public.partner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_partner_profiles();

-- RLS on partner_profiles: user can select and update only is_online and radius_km on their own row
ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can select own partner profile" ON public.partner_profiles;
CREATE POLICY "Partners can select own partner profile"
  ON public.partner_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Partners can update own partner profile" ON public.partner_profiles;
CREATE POLICY "Partners can update own partner profile"
  ON public.partner_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Partners can insert own partner profile" ON public.partner_profiles;
CREATE POLICY "Partners can insert own partner profile"
  ON public.partner_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can select partner profiles" ON public.partner_profiles;
CREATE POLICY "Admins can select partner profiles"
  ON public.partner_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update partner profiles" ON public.partner_profiles;
CREATE POLICY "Admins can update partner profiles"
  ON public.partner_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- 2. Create print_jobs table linked to print_orders
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.print_orders(id) ON DELETE CASCADE UNIQUE,
  partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'SEARCHING_PARTNER',
      'ACCEPTED',
      'AT_SHOP',
      'PRINTING',
      'PICKED_UP',
      'IN_TRANSIT',
      'ARRIVED_AT_DROP',
      'DELIVERED',
      'COMPLETED',
      'NO_PARTNER_FOUND',
      'CANCELLED'
    )
  ) DEFAULT 'SEARCHING_PARTNER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_order_id ON public.print_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_partner_id ON public.print_jobs(partner_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON public.print_jobs(status);

-- Trigger on print_jobs that blocks any change to partner_id once it is set, except to NULL by service_role
CREATE OR REPLACE FUNCTION public.fn_protect_print_job_partner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role BOOLEAN;
BEGIN
  v_is_service_role := (auth.role() = 'service_role');

  IF OLD.partner_id IS NOT NULL AND NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
    IF NOT (NEW.partner_id IS NULL AND v_is_service_role) THEN
      RAISE EXCEPTION 'partner_id cannot be changed once set, except to NULL by service_role';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_print_job_partner ON public.print_jobs;
CREATE TRIGGER tr_protect_print_job_partner
  BEFORE UPDATE ON public.print_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_print_job_partner();

-- 3. Create print_job_offers table
CREATE TABLE IF NOT EXISTS public.print_job_offers (
  job_id UUID NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('OFFERED', 'REJECTED', 'EXPIRED')) DEFAULT 'OFFERED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_print_job_offers_job_id ON public.print_job_offers(job_id);
CREATE INDEX IF NOT EXISTS idx_print_job_offers_partner_id ON public.print_job_offers(partner_id);

-- 4. RLS for print_jobs and print_job_offers
-- Partners can select only print_jobs they hold or have an OFFERED row for.
-- Customers can select the job for their own order.
-- No client insert or update policies on print_jobs.
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can select assigned or offered print jobs" ON public.print_jobs;
CREATE POLICY "Partners can select assigned or offered print jobs"
  ON public.print_jobs
  FOR SELECT
  TO authenticated
  USING (
    partner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.print_job_offers pjo
      WHERE pjo.job_id = print_jobs.id
        AND pjo.partner_id = auth.uid()
        AND pjo.status = 'OFFERED'
    )
  );

DROP POLICY IF EXISTS "Customers can select print jobs for own orders" ON public.print_jobs;
CREATE POLICY "Customers can select print jobs for own orders"
  ON public.print_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.print_orders po
      WHERE po.id = print_jobs.order_id
        AND po.customer_id = auth.uid()
    )
  );

ALTER TABLE public.print_job_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can select own print job offers" ON public.print_job_offers;
CREATE POLICY "Partners can select own print job offers"
  ON public.print_job_offers
  FOR SELECT
  TO authenticated
  USING (partner_id = auth.uid());

-- 5. accept_print_job function
-- Note: This is the only write path for partner_id and bypasses RLS by design, with the caller checked inside.
CREATE OR REPLACE FUNCTION public.accept_print_job(p_job_id UUID)
RETURNS public.print_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_job public.print_jobs%ROWTYPE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Caller must be an approved, online partner
  IF NOT EXISTS (
    SELECT 1 FROM public.partner_profiles
    WHERE user_id = v_caller_id
      AND is_approved = true
      AND is_online = true
  ) THEN
    RAISE EXCEPTION 'Caller must be an approved, online partner';
  END IF;

  -- Caller must have an offer with status OFFERED
  IF NOT EXISTS (
    SELECT 1 FROM public.print_job_offers
    WHERE job_id = p_job_id
      AND partner_id = v_caller_id
      AND status = 'OFFERED'
  ) THEN
    RAISE EXCEPTION 'No active offer found for this caller and job';
  END IF;

  -- Conditional UPDATE so exactly one partner can win
  UPDATE public.print_jobs
  SET partner_id = v_caller_id,
      status = 'ACCEPTED',
      updated_at = NOW()
  WHERE id = p_job_id
    AND partner_id IS NULL
    AND status = 'SEARCHING_PARTNER'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Print job is no longer available';
  END IF;

  RETURN v_job;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_print_job(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_print_job(UUID) TO authenticated;

-- 6. reject_print_job function
CREATE OR REPLACE FUNCTION public.reject_print_job(p_job_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Record rejection in print_job_offers only for caller
  UPDATE public.print_job_offers
  SET status = 'REJECTED',
      updated_at = NOW()
  WHERE job_id = p_job_id
    AND partner_id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No offer found for this job and partner';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_print_job(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_print_job(UUID) TO authenticated;
