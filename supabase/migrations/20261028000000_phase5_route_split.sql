-- ==============================================================================
-- Migration: 20261028000000_phase5_route_split.sql
-- ==============================================================================

-- 1. Route columns on partner_profiles
ALTER TABLE public.partner_profiles
  ADD COLUMN IF NOT EXISTS razorpay_account_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS razorpay_account_status text NOT NULL DEFAULT 'NONE';

-- 2. Trigger function to block client route column updates
CREATE OR REPLACE FUNCTION public.fn_block_client_route_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF (NEW.razorpay_account_id IS DISTINCT FROM OLD.razorpay_account_id) OR
       (NEW.razorpay_account_status IS DISTINCT FROM OLD.razorpay_account_status) THEN
      RAISE EXCEPTION 'Route account fields are set by the server only';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_block_client_route_columns ON public.partner_profiles;
DROP TRIGGER IF EXISTS trg_block_client_route_columns ON public.partner_profiles;
CREATE TRIGGER tr_block_client_route_columns
  BEFORE UPDATE ON public.partner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_block_client_route_columns();

-- 3. Transfer columns on print_orders and parcel_orders
ALTER TABLE public.print_orders
  ADD COLUMN IF NOT EXISTS transfer_amount int,
  ADD COLUMN IF NOT EXISTS transfer_status text NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS transfer_id text;

ALTER TABLE public.parcel_orders
  ADD COLUMN IF NOT EXISTS transfer_amount int,
  ADD COLUMN IF NOT EXISTS transfer_status text NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS transfer_id text;

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';
