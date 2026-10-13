-- Phase 2 migration: listings, listing_photos, favorites, indexes, bucket, RLS, and photo limit trigger
-- Run this SQL in Supabase SQL Editor (once). It is safe to run on a fresh Phase 1 DB.

-- 1. Create listings table
CREATE TABLE IF NOT EXISTS public.listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
    category text NOT NULL CHECK (category IN ('books','calculators','sports','electronics','projects','events','essentials')),
    description text NOT NULL CHECK (char_length(description) <= 1000),
    condition text NOT NULL CHECK (condition IN ('LIKE_NEW','GOOD','FAIR','HEAVILY_USED')),
    price_per_day int NOT NULL CHECK (price_per_day BETWEEN 10 AND 100),
    max_rental_days int CHECK (max_rental_days BETWEEN 1 AND 30),
    college text,
    pickup_zone text,
    delivery_available boolean NOT NULL DEFAULT false,
    pickup_available boolean NOT NULL DEFAULT true,
    rules text NOT NULL CHECK (char_length(rules) <= 500),
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','REMOVED')),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Create listing_photos table
CREATE TABLE IF NOT EXISTS public.listing_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    position int NOT NULL CHECK (position >= 0),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Create favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, listing_id)
);

-- 4. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_listings_status_category_price_created
    ON public.listings (status, category, price_per_day, created_at);
CREATE INDEX IF NOT EXISTS idx_listing_photos_listing_position
    ON public.listing_photos (listing_id, position);

-- 5. Storage bucket for listing photos (run manually via Supabase UI if bucket already exists)
-- The bucket name must be "listing-photos". Ensure public read, and a policy restricting writes to the owner.
-- In Supabase UI: Storage → Buckets → Create bucket "listing-photos" with Public read.

-- 6. Row Level Security policies
-- Enable RLS on new tables
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Listings policies
CREATE POLICY "public_active_listings" ON public.listings
    FOR SELECT USING (status = 'ACTIVE');
CREATE POLICY "owner_all_listings" ON public.listings
    FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "owner_insert" ON public.listings
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner_update" ON public.listings
    FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner_delete" ON public.listings
    FOR DELETE USING (auth.uid() = owner_id);

-- Listing photos policies (readable if parent listing readable, writable only by owner)
CREATE POLICY "photos_read" ON public.listing_photos
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.status = 'ACTIVE'));
CREATE POLICY "owner_photos" ON public.listing_photos
    FOR ALL USING (auth.uid() = (SELECT owner_id FROM public.listings WHERE id = listing_id)) WITH CHECK (auth.uid() = (SELECT owner_id FROM public.listings WHERE id = listing_id));

-- Favorites policies (users can manage only their own rows)
CREATE POLICY "favorites_self" ON public.favorites
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Trigger to enforce max 8 photos per listing
CREATE OR REPLACE FUNCTION public.enforce_photo_limit()
RETURNS trigger AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.listing_photos WHERE listing_id = NEW.listing_id) >= 8 THEN
        RAISE EXCEPTION 'Maximum of 8 photos per listing exceeded';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_photo_limit
BEFORE INSERT ON public.listing_photos
FOR EACH ROW EXECUTE FUNCTION public.enforce_photo_limit();

-- 8. Ensure timestamps update on row modification
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_listings_updated_at
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- End of Phase 2 migration
