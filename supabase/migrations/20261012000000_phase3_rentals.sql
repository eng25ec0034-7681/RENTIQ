-- Phase 3 migration: rental_requests table, indexes, RLS policies, and triggers
-- Run this in Supabase SQL Editor once on top of Phase 1 and Phase 2.

-- 1. Create rental_requests table
CREATE TABLE IF NOT EXISTS public.rental_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    renter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    delivery_type text NOT NULL CHECK (delivery_type IN ('PICKUP', 'DELIVERY')),
    delivery_location text,
    total_days int NOT NULL CHECK (total_days >= 1),
    total_price int NOT NULL CHECK (total_price >= 0),
    status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'ACTIVE', 'RETURNED', 'CANCELLED')),
    notes text CHECK (char_length(notes) <= 500),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT chk_rental_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_renter_not_owner CHECK (renter_id != owner_id)
);

-- 2. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_rental_requests_renter
    ON public.rental_requests (renter_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_rental_requests_owner
    ON public.rental_requests (owner_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_rental_requests_listing
    ON public.rental_requests (listing_id, status);

-- 3. Row Level Security policies
ALTER TABLE public.rental_requests ENABLE ROW LEVEL SECURITY;

-- Read: Both the renter and the item owner can view the request
CREATE POLICY "rental_requests_participants_select" ON public.rental_requests
    FOR SELECT USING (auth.uid() = renter_id OR auth.uid() = owner_id);

-- Insert: Renters can create a request with their own user id
CREATE POLICY "rental_requests_renter_insert" ON public.rental_requests
    FOR INSERT WITH CHECK (auth.uid() = renter_id);

-- Update: Renters can update/cancel their own pending request
CREATE POLICY "rental_requests_renter_update" ON public.rental_requests
    FOR UPDATE USING (auth.uid() = renter_id) WITH CHECK (auth.uid() = renter_id);

-- Update: Owners can update request status (Approve, Reject, Complete)
CREATE POLICY "rental_requests_owner_update" ON public.rental_requests
    FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 4. Timestamp trigger
DROP TRIGGER IF EXISTS trg_rental_requests_updated_at ON public.rental_requests;
CREATE TRIGGER trg_rental_requests_updated_at
BEFORE UPDATE ON public.rental_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- End of Phase 3 migration
