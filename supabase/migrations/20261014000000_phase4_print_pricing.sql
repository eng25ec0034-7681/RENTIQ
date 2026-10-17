-- Phase 4 Print & Xerox Pricing Migration

-- 1. Create platform_settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on platform_settings: read for authenticated users, no client write policy
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on platform_settings" ON public.platform_settings;
CREATE POLICY "Allow authenticated read on platform_settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Seed default pricing settings
INSERT INTO public.platform_settings (key, value)
VALUES
  ('bw_single_per_side', '2'::jsonb),
  ('bw_double_per_sheet', '4'::jsonb),
  ('colour_single_per_side', '10'::jsonb),
  ('colour_double_per_sheet', '20'::jsonb),
  ('binding_fee', '20'::jsonb),
  ('stapling_fee', '2'::jsonb),
  ('delivery_fee', '5'::jsonb),
  ('platform_fee', '0'::jsonb),
  ('security_deposit', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Create print_orders table
CREATE TABLE IF NOT EXISTS public.print_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pages INT NOT NULL CHECK (pages >= 1),
  copies INT NOT NULL CHECK (copies BETWEEN 1 AND 100),
  colour BOOLEAN NOT NULL DEFAULT false,
  double_sided BOOLEAN NOT NULL DEFAULT false,
  paper_size TEXT NOT NULL CHECK (paper_size IN ('A4', 'A3')),
  binding BOOLEAN NOT NULL DEFAULT false,
  stapling BOOLEAN NOT NULL DEFAULT false,
  fulfillment TEXT NOT NULL CHECK (fulfillment IN ('PICKUP', 'DELIVERY')),
  printing_cost INT NOT NULL DEFAULT 0,
  delivery_fee INT NOT NULL DEFAULT 0,
  platform_fee INT NOT NULL DEFAULT 0,
  total_amount INT NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'UPI')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  status TEXT NOT NULL DEFAULT 'PLACED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing print_orders
CREATE INDEX IF NOT EXISTS idx_print_orders_customer_id ON public.print_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_print_orders_status ON public.print_orders(status);

-- RLS on print_orders: customers can select and insert own orders only
ALTER TABLE public.print_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can select own print orders" ON public.print_orders;
CREATE POLICY "Customers can select own print orders"
  ON public.print_orders
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert own print orders" ON public.print_orders;
CREATE POLICY "Customers can insert own print orders"
  ON public.print_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- 4. BEFORE INSERT trigger function to recompute money columns from platform_settings
CREATE OR REPLACE FUNCTION public.recompute_print_order_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bw_single INT;
  v_bw_double INT;
  v_colour_single INT;
  v_colour_double INT;
  v_binding_fee INT;
  v_stapling_fee INT;
  v_delivery_fee INT;
  v_platform_fee INT;

  v_physical_sheets INT;
  v_printing_cost INT;
BEGIN
  IF NEW.pages IS NULL OR NEW.copies IS NULL THEN
    RAISE EXCEPTION 'pages and copies are required';
  END IF;

  -- Customers can never set these; the server always resets them
  NEW.payment_status := 'PENDING';
  NEW.status := 'PLACED';

  -- Read rates from platform_settings with standard fallback defaults
  SELECT COALESCE((value#>>'{}')::INT, 2) INTO v_bw_single
  FROM public.platform_settings WHERE key = 'bw_single_per_side';
  IF v_bw_single IS NULL THEN v_bw_single := 2; END IF;

  SELECT COALESCE((value#>>'{}')::INT, 4) INTO v_bw_double
  FROM public.platform_settings WHERE key = 'bw_double_per_sheet';
  IF v_bw_double IS NULL THEN v_bw_double := 4; END IF;

  SELECT COALESCE((value#>>'{}')::INT, 10) INTO v_colour_single
  FROM public.platform_settings WHERE key = 'colour_single_per_side';
  IF v_colour_single IS NULL THEN v_colour_single := 10; END IF;

  SELECT COALESCE((value#>>'{}')::INT, 20) INTO v_colour_double
  FROM public.platform_settings WHERE key = 'colour_double_per_sheet';
  IF v_colour_double IS NULL THEN v_colour_double := 20; END IF;

  SELECT COALESCE((value#>>'{}')::INT, 20) INTO v_binding_fee
  FROM public.platform_settings WHERE key = 'binding_fee';
  IF v_binding_fee IS NULL THEN v_binding_fee := 20; END IF;

  SELECT COALESCE((value#>>'{}')::INT, 2) INTO v_stapling_fee
  FROM public.platform_settings WHERE key = 'stapling_fee';
  IF v_stapling_fee IS NULL THEN v_stapling_fee := 2; END IF;

  SELECT COALESCE((value#>>'{}')::INT, 5) INTO v_delivery_fee
  FROM public.platform_settings WHERE key = 'delivery_fee';
  IF v_delivery_fee IS NULL THEN v_delivery_fee := 5; END IF;

  SELECT COALESCE((value#>>'{}')::INT, 0) INTO v_platform_fee
  FROM public.platform_settings WHERE key = 'platform_fee';
  IF v_platform_fee IS NULL THEN v_platform_fee := 0; END IF;

  -- Calculate printing cost: double-sided vs single-sided, colour vs B&W
  IF COALESCE(NEW.double_sided, false) THEN
    v_physical_sheets := CEIL(NEW.pages::NUMERIC / 2.0)::INT;
    IF COALESCE(NEW.colour, false) THEN
      v_printing_cost := v_physical_sheets * v_colour_double * NEW.copies;
    ELSE
      v_printing_cost := v_physical_sheets * v_bw_double * NEW.copies;
    END IF;
  ELSE
    IF COALESCE(NEW.colour, false) THEN
      v_printing_cost := NEW.pages * NEW.copies * v_colour_single;
    ELSE
      v_printing_cost := NEW.pages * NEW.copies * v_bw_single;
    END IF;
  END IF;

  -- Add binding & stapling fees per order
  IF COALESCE(NEW.binding, false) THEN
    v_printing_cost := v_printing_cost + v_binding_fee;
  END IF;

  IF COALESCE(NEW.stapling, false) THEN
    v_printing_cost := v_printing_cost + v_stapling_fee;
  END IF;

  NEW.printing_cost := v_printing_cost;

  -- Calculate delivery fee
  IF NEW.fulfillment = 'DELIVERY' THEN
    NEW.delivery_fee := v_delivery_fee;
  ELSE
    NEW.delivery_fee := 0;
  END IF;

  -- Platform fee
  NEW.platform_fee := v_platform_fee;

  -- Total amount
  NEW.total_amount := NEW.printing_cost + NEW.delivery_fee + NEW.platform_fee;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_print_order_amounts ON public.print_orders;
CREATE TRIGGER trg_recompute_print_order_amounts
BEFORE INSERT ON public.print_orders
FOR EACH ROW
EXECUTE FUNCTION public.recompute_print_order_amounts();
