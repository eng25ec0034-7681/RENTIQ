-- Phase 5: Job flow, handover OTP codes, parcel transitions, and partner active jobs

-- ==============================================================================
-- 1. HANDOVER CODES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.handover_codes (
  job_kind text NOT NULL CHECK (job_kind IN ('PRINT', 'PARCEL')),
  job_id uuid NOT NULL,
  code text NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (job_kind, job_id)
);

ALTER TABLE public.handover_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_make_handover_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'print_jobs' THEN
    INSERT INTO public.handover_codes (job_kind, job_id, code)
    VALUES ('PRINT', NEW.id, lpad(floor(random() * 10000)::int::text, 4, '0'))
    ON CONFLICT DO NOTHING;
  ELSIF TG_TABLE_NAME = 'parcel_jobs' THEN
    INSERT INTO public.handover_codes (job_kind, job_id, code)
    VALUES ('PARCEL', NEW.id, lpad(floor(random() * 10000)::int::text, 4, '0'))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_make_handover_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_make_handover_code() TO authenticated;

DROP TRIGGER IF EXISTS tr_make_handover_code_print ON public.print_jobs;
CREATE TRIGGER tr_make_handover_code_print
  AFTER INSERT ON public.print_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_make_handover_code();

DROP TRIGGER IF EXISTS tr_make_handover_code_parcel ON public.parcel_jobs;
CREATE TRIGGER tr_make_handover_code_parcel
  AFTER INSERT ON public.parcel_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_make_handover_code();

-- Backfill existing print_jobs and parcel_jobs rows that lack one
INSERT INTO public.handover_codes (job_kind, job_id, code)
SELECT 'PRINT', pj.id, lpad(floor(random() * 10000)::int::text, 4, '0')
FROM public.print_jobs pj
ON CONFLICT DO NOTHING;

INSERT INTO public.handover_codes (job_kind, job_id, code)
SELECT 'PARCEL', pj.id, lpad(floor(random() * 10000)::int::text, 4, '0')
FROM public.parcel_jobs pj
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 2. CANCEL RULE (print)
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

  -- 2. CANCELLED allowed only from SEARCHING_PARTNER (customer of the order or service_role)
  IF NEW.status = 'CANCELLED' AND OLD.status = 'SEARCHING_PARTNER' THEN
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

REVOKE EXECUTE ON FUNCTION public.fn_enforce_print_job_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_enforce_print_job_status() TO authenticated;

-- ==============================================================================
-- 3. PARCEL TRANSITIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_enforce_parcel_job_status()
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
      RAISE EXCEPTION 'Invalid parcel job transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  -- 2. CANCELLED allowed only from SEARCHING_PARTNER (customer of the order or service_role)
  IF NEW.status = 'CANCELLED' AND OLD.status = 'SEARCHING_PARTNER' THEN
    IF v_is_service_role THEN
      RETURN NEW;
    END IF;

    SELECT customer_id INTO v_customer_id FROM public.parcel_orders WHERE id = NEW.order_id;
    IF v_caller_id IS NOT NULL AND v_caller_id = v_customer_id THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Invalid parcel job transition from % to %', OLD.status, NEW.status;
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
      RAISE EXCEPTION 'Invalid parcel job transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  -- 4. Anything else
  RAISE EXCEPTION 'Invalid parcel job transition from % to %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_parcel_job_status ON public.parcel_jobs;
CREATE TRIGGER tr_enforce_parcel_job_status
  BEFORE UPDATE OF status ON public.parcel_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enforce_parcel_job_status();

REVOKE EXECUTE ON FUNCTION public.fn_enforce_parcel_job_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_enforce_parcel_job_status() TO authenticated;

-- ==============================================================================
-- 4. ADVANCE FUNCTIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.advance_print_job(p_job_id UUID, p_next TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_partner_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT partner_id INTO v_partner_id
  FROM public.print_jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_partner_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Only the assigned partner can update this job';
  END IF;

  IF p_next = 'COMPLETED' THEN
    RAISE EXCEPTION 'Use confirm_handover to complete this job';
  END IF;

  UPDATE public.print_jobs
  SET status = p_next,
      updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.advance_print_job(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_print_job(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_parcel_job(p_job_id UUID, p_next TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_partner_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT partner_id INTO v_partner_id
  FROM public.parcel_jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_partner_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Only the assigned partner can update this job';
  END IF;

  IF p_next = 'COMPLETED' THEN
    RAISE EXCEPTION 'Use confirm_handover to complete this job';
  END IF;

  UPDATE public.parcel_jobs
  SET status = p_next,
      updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.advance_parcel_job(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_parcel_job(UUID, TEXT) TO authenticated;

-- ==============================================================================
-- 5. CONFIRM HANDOVER (OTP check)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.confirm_handover(p_job_kind TEXT, p_job_id UUID, p_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_kind TEXT;
  v_partner_id UUID;
  v_expected_code TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_kind := upper(trim(p_job_kind));

  IF v_kind = 'PRINT' THEN
    SELECT partner_id INTO v_partner_id
    FROM public.print_jobs
    WHERE id = p_job_id;
  ELSIF v_kind = 'PARCEL' THEN
    SELECT partner_id INTO v_partner_id
    FROM public.parcel_jobs
    WHERE id = p_job_id;
  ELSE
    RAISE EXCEPTION 'Invalid job kind: %', p_job_kind;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_partner_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Only the assigned partner can confirm handover';
  END IF;

  SELECT code INTO v_expected_code
  FROM public.handover_codes
  WHERE job_kind = v_kind
    AND job_id = p_job_id;

  IF NOT FOUND OR v_expected_code <> trim(p_code) THEN
    RAISE EXCEPTION 'Handover code does not match';
  END IF;

  IF v_kind = 'PRINT' THEN
    UPDATE public.print_jobs
    SET status = 'COMPLETED',
        updated_at = NOW()
    WHERE id = p_job_id;
  ELSIF v_kind = 'PARCEL' THEN
    UPDATE public.parcel_jobs
    SET status = 'COMPLETED',
        updated_at = NOW()
    WHERE id = p_job_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_handover(TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_handover(TEXT, UUID, TEXT) TO authenticated;

-- ==============================================================================
-- 6. CUSTOMER VIEW OF THE CODE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_my_handover_code(p_job_kind TEXT, p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_kind TEXT;
  v_customer_id UUID;
  v_job_id UUID;
  v_partner_id UUID;
  v_code TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_kind := upper(trim(p_job_kind));

  IF v_kind = 'PRINT' THEN
    SELECT customer_id INTO v_customer_id
    FROM public.print_orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_customer_id IS DISTINCT FROM v_caller_id THEN
      RAISE EXCEPTION 'Not your order';
    END IF;

    SELECT id, partner_id INTO v_job_id, v_partner_id
    FROM public.print_jobs
    WHERE order_id = p_order_id;

  ELSIF v_kind = 'PARCEL' THEN
    SELECT customer_id INTO v_customer_id
    FROM public.parcel_orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_customer_id IS DISTINCT FROM v_caller_id THEN
      RAISE EXCEPTION 'Not your order';
    END IF;

    SELECT id, partner_id INTO v_job_id, v_partner_id
    FROM public.parcel_jobs
    WHERE order_id = p_order_id;

  ELSE
    RAISE EXCEPTION 'Invalid job kind: %', p_job_kind;
  END IF;

  IF v_job_id IS NULL OR v_partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT code INTO v_code
  FROM public.handover_codes
  WHERE job_kind = v_kind
    AND job_id = v_job_id;

  RETURN v_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_handover_code(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_handover_code(TEXT, UUID) TO authenticated;

-- ==============================================================================
-- 7. CUSTOMER ORDER LIST
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_my_orders()
RETURNS TABLE (
  kind TEXT,
  order_id UUID,
  pickup_zone TEXT,
  job_status TEXT,
  payment_status TEXT,
  total_amount INT,
  created_at TIMESTAMPTZ,
  partner_assigned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      'PRINT'::TEXT AS kind,
      po.id AS order_id,
      po.pickup_zone,
      pj.status::TEXT AS job_status,
      po.payment_status,
      po.total_amount,
      po.created_at,
      (pj.partner_id IS NOT NULL) AS partner_assigned
    FROM public.print_orders po
    LEFT JOIN public.print_jobs pj ON pj.order_id = po.id
    WHERE po.customer_id = auth.uid()

    UNION ALL

    SELECT
      'PARCEL'::TEXT AS kind,
      po.id AS order_id,
      po.pickup_zone,
      pj.status::TEXT AS job_status,
      po.payment_status,
      po.total_amount,
      po.created_at,
      (pj.partner_id IS NOT NULL) AS partner_assigned
    FROM public.parcel_orders po
    LEFT JOIN public.parcel_jobs pj ON pj.order_id = po.id
    WHERE po.customer_id = auth.uid()
  ) sub
  ORDER BY sub.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_orders() TO authenticated;

-- ==============================================================================
-- 8. PARTNER ACTIVE JOBS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_my_active_jobs()
RETURNS TABLE (
  kind TEXT,
  job_id UUID,
  order_id UUID,
  job_status TEXT,
  pickup_zone TEXT,
  drop_point TEXT,
  item_description TEXT,
  file_path TEXT,
  payment_status TEXT,
  total_amount INT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      'PRINT'::TEXT AS kind,
      pj.id AS job_id,
      pj.order_id,
      pj.status::TEXT AS job_status,
      po.pickup_zone,
      NULL::TEXT AS drop_point,
      NULL::TEXT AS item_description,
      po.file_path,
      po.payment_status,
      po.total_amount,
      pj.created_at
    FROM public.print_jobs pj
    JOIN public.print_orders po ON po.id = pj.order_id
    WHERE pj.partner_id = auth.uid()
      AND pj.status NOT IN ('COMPLETED', 'CANCELLED')

    UNION ALL

    SELECT
      'PARCEL'::TEXT AS kind,
      pj.id AS job_id,
      pj.order_id,
      pj.status::TEXT AS job_status,
      po.pickup_zone,
      po.drop_point,
      po.item_description,
      NULL::TEXT AS file_path,
      po.payment_status,
      po.total_amount,
      pj.created_at
    FROM public.parcel_jobs pj
    JOIN public.parcel_orders po ON po.id = pj.order_id
    WHERE pj.partner_id = auth.uid()
      AND pj.status NOT IN ('COMPLETED', 'CANCELLED')
  ) sub
  ORDER BY sub.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_active_jobs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_active_jobs() TO authenticated;

-- ==============================================================================
-- 9. STORAGE ACCESS FOR THE ACCEPTED PARTNER
-- ==============================================================================

DROP POLICY IF EXISTS "print_files_partner_select" ON storage.objects;
CREATE POLICY "print_files_partner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'print-files'
    AND EXISTS (
      SELECT 1
      FROM public.print_orders o
      JOIN public.print_jobs j ON j.order_id = o.id
      WHERE o.file_path = storage.objects.name
        AND j.partner_id = auth.uid()
    )
  );

-- ==============================================================================
-- 10. END OF FILE
-- ==============================================================================

NOTIFY pgrst, 'reload schema';
