-- Phase 4 Batch C, Day 5: Parcel Orders (Database and API)

-- 1. Insert parcel_fee into platform_settings
INSERT INTO public.platform_settings (key, value)
VALUES ('parcel_fee', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Create parcel_orders table
CREATE TABLE IF NOT EXISTS public.parcel_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pickup_zone text NOT NULL CHECK (char_length(pickup_zone) BETWEEN 2 AND 60),
  drop_point text NOT NULL CHECK (char_length(drop_point) BETWEEN 3 AND 200),
  item_description text NOT NULL CHECK (char_length(item_description) BETWEEN 3 AND 200),
  weight_kg numeric NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 5),
  no_banned_items boolean NOT NULL CHECK (no_banned_items = true),
  parcel_fee int NOT NULL DEFAULT 0,
  platform_fee int NOT NULL DEFAULT 0,
  total_amount int NOT NULL DEFAULT 0,
  payment_method text NOT NULL CHECK (payment_method IN ('CASH', 'UPI')),
  payment_status text NOT NULL DEFAULT 'PENDING',
  status text NOT NULL DEFAULT 'PLACED',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parcel_orders_customer_id ON public.parcel_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_parcel_orders_status ON public.parcel_orders(status);

-- 3. RLS on parcel_orders
ALTER TABLE public.parcel_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can select own parcel orders" ON public.parcel_orders;
CREATE POLICY "Customers can select own parcel orders"
  ON public.parcel_orders
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert own parcel orders" ON public.parcel_orders;
CREATE POLICY "Customers can insert own parcel orders"
  ON public.parcel_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- 4. BEFORE INSERT trigger fn_set_parcel_amounts
CREATE OR REPLACE FUNCTION public.fn_set_parcel_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parcel_fee INT;
  v_platform_fee INT;
BEGIN
  -- Read rates from platform_settings
  SELECT (value#>>'{}')::INT INTO v_parcel_fee
  FROM public.platform_settings WHERE key = 'parcel_fee';
  IF NOT FOUND OR v_parcel_fee IS NULL THEN
    RAISE EXCEPTION 'Missing platform setting: parcel_fee';
  END IF;

  SELECT (value#>>'{}')::INT INTO v_platform_fee
  FROM public.platform_settings WHERE key = 'platform_fee';
  IF NOT FOUND OR v_platform_fee IS NULL THEN
    RAISE EXCEPTION 'Missing platform setting: platform_fee';
  END IF;

  NEW.parcel_fee := v_parcel_fee;
  NEW.platform_fee := v_platform_fee;
  NEW.total_amount := v_parcel_fee + v_platform_fee;
  NEW.payment_status := 'PENDING';
  NEW.status := 'PLACED';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_parcel_amounts ON public.parcel_orders;
CREATE TRIGGER trg_set_parcel_amounts
BEFORE INSERT ON public.parcel_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_parcel_amounts();

-- 5. Parcel job tables
CREATE TABLE IF NOT EXISTS public.parcel_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.parcel_orders(id) ON DELETE CASCADE UNIQUE,
  partner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'SEARCHING_PARTNER',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parcel_jobs_order_id ON public.parcel_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_parcel_jobs_partner_id ON public.parcel_jobs(partner_id);
CREATE INDEX IF NOT EXISTS idx_parcel_jobs_status ON public.parcel_jobs(status);

CREATE TABLE IF NOT EXISTS public.parcel_job_offers (
  job_id uuid NOT NULL REFERENCES public.parcel_jobs(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'OFFERED',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (job_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_parcel_job_offers_job_id ON public.parcel_job_offers(job_id);
CREATE INDEX IF NOT EXISTS idx_parcel_job_offers_partner_id ON public.parcel_job_offers(partner_id);

-- RLS on parcel_jobs and parcel_job_offers
ALTER TABLE public.parcel_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_job_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can select parcel jobs for own orders" ON public.parcel_jobs;
CREATE POLICY "Customers can select parcel jobs for own orders"
  ON public.parcel_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parcel_orders po
      WHERE po.id = parcel_jobs.order_id
        AND po.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Partners can select assigned or offered parcel jobs" ON public.parcel_jobs;
CREATE POLICY "Partners can select assigned or offered parcel jobs"
  ON public.parcel_jobs
  FOR SELECT
  TO authenticated
  USING (
    partner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.parcel_job_offers pjo
      WHERE pjo.job_id = parcel_jobs.id
        AND pjo.partner_id = auth.uid()
        AND pjo.status = 'OFFERED'
    )
  );

DROP POLICY IF EXISTS "Partners can select own parcel job offers" ON public.parcel_job_offers;
CREATE POLICY "Partners can select own parcel job offers"
  ON public.parcel_job_offers
  FOR SELECT
  TO authenticated
  USING (partner_id = auth.uid());

DROP POLICY IF EXISTS "Customers can select parcel job offers for own orders" ON public.parcel_job_offers;
CREATE POLICY "Customers can select parcel job offers for own orders"
  ON public.parcel_job_offers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parcel_jobs pj
      JOIN public.parcel_orders po ON po.id = pj.order_id
      WHERE pj.id = parcel_job_offers.job_id
        AND po.customer_id = auth.uid()
    )
  );

-- 6. create_parcel_job function
CREATE OR REPLACE FUNCTION public.create_parcel_job(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_service_role BOOLEAN;
  v_order public.parcel_orders%ROWTYPE;
  v_existing_job_id UUID;
  v_job_id UUID;
BEGIN
  v_caller_id := auth.uid();
  v_is_service_role := (auth.role() = 'service_role');

  -- Fetch order
  SELECT * INTO v_order FROM public.parcel_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcel order not found';
  END IF;

  -- Only the order's customer or service_role may call it
  IF NOT (v_is_service_role OR (v_caller_id IS NOT NULL AND v_caller_id = v_order.customer_id)) THEN
    RAISE EXCEPTION 'Only the order customer or service_role may create a parcel job';
  END IF;

  -- If the job already exists, return its id and do nothing
  SELECT id INTO v_existing_job_id FROM public.parcel_jobs WHERE order_id = p_order_id;
  IF v_existing_job_id IS NOT NULL THEN
    RETURN v_existing_job_id;
  END IF;

  -- Insert parcel_jobs row (status 'SEARCHING_PARTNER')
  INSERT INTO public.parcel_jobs (order_id, status)
  VALUES (p_order_id, 'SEARCHING_PARTNER')
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN
    SELECT id INTO v_job_id FROM public.parcel_jobs WHERE order_id = p_order_id;
    RETURN v_job_id;
  END IF;

  -- Insert one parcel_job_offers row (status 'OFFERED') for each partner in partner_profiles
  -- where is_approved = true AND is_online = true AND the order's pickup_zone is in zones (case-insensitive trim)
  INSERT INTO public.parcel_job_offers (job_id, partner_id, status)
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

REVOKE EXECUTE ON FUNCTION public.create_parcel_job(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_parcel_job(UUID) TO authenticated;
