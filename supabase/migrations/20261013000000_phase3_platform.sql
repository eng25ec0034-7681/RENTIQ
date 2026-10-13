-- ==============================================================================
-- PHASE 3 MIGRATION: RENTALS, STATUS TRANSITIONS, EVIDENCE, MESSAGING, NOTIFICATIONS
-- File: supabase/migrations/20261013000000_phase3_platform.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & STORAGE BUCKET
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Private bucket for rental handover & return evidence photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('rental-evidence', 'rental-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ------------------------------------------------------------------------------
-- 2. BLOCKS & REPORTS TABLES (Safety & Anti-Harassment)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
    blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT chk_blocks_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type text NOT NULL CHECK (target_type IN ('USER', 'LISTING', 'RENTAL', 'MESSAGE')),
    target_id text NOT NULL,
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. RENTALS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rentals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    renter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days int NOT NULL CHECK (days >= 1),
    price_per_day int NOT NULL CHECK (price_per_day >= 10),
    rental_amount int NOT NULL CHECK (rental_amount >= 0),
    security_deposit int NOT NULL DEFAULT 0 CHECK (security_deposit = 0),
    platform_fee int NOT NULL DEFAULT 0 CHECK (platform_fee = 0),
    total_amount int NOT NULL CHECK (total_amount >= 0),
    fulfillment text NOT NULL CHECK (fulfillment IN ('PICKUP', 'DELIVERY')),
    message text CHECK (message IS NULL OR char_length(message) <= 500),
    payment_method text NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'UPI')),
    payment_status text NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
        'REQUESTED',
        'ACCEPTED',
        'PAYMENT_PENDING',
        'CONFIRMED',
        'PICKUP_DELIVERY_PENDING',
        'ITEM_PICKED_UP',
        'RENTAL_ACTIVE',
        'RETURN_REQUESTED',
        'RETURN_DELIVERY',
        'RETURNED',
        'COMPLETED',
        'REJECTED',
        'CANCELLED',
        'EXPIRED',
        'OVERDUE',
        'DISPUTED',
        'DAMAGED_REVIEW'
    )),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_rentals_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_rentals_renter_not_owner CHECK (renter_id <> owner_id)
);

-- ------------------------------------------------------------------------------
-- 4. RENTAL STATUS EVENTS TABLE (Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rental_status_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
    from_status text,
    to_status text NOT NULL,
    changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. RENTAL EVIDENCE TABLE (Handover & Return Photos / Notes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rental_evidence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('HANDOVER', 'RETURN')),
    photo_paths text[] NOT NULL DEFAULT '{}' CHECK (cardinality(photo_paths) <= 6),
    condition_notes text CHECK (condition_notes IS NULL OR char_length(condition_notes) <= 1000),
    damage_notes text CHECK (damage_notes IS NULL OR char_length(damage_notes) <= 1000),
    created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 6. CONVERSATIONS AND MESSAGES (Listing / Rental Chats)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL,
    renter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_conversation_listing_renter UNIQUE (listing_id, renter_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 7. NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    link text,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 8. INDEXES FOR PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rentals_renter ON public.rentals(renter_id, status);
CREATE INDEX IF NOT EXISTS idx_rentals_owner ON public.rentals(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_rentals_listing_status ON public.rentals(listing_id, status);
CREATE INDEX IF NOT EXISTS idx_rentals_dates ON public.rentals(listing_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rental_status_events_rental ON public.rental_status_events(rental_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rental_evidence_rental ON public.rental_evidence(rental_id, type);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(renter_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read_at, created_at);

-- ------------------------------------------------------------------------------
-- 9. TRIGGERS & CONSTRAINTS ENFORCEMENT
-- ------------------------------------------------------------------------------

-- 9a. Validate Rental Insertion: Listing Active, Owner snapshot, Pricing snapshot, Block checks
CREATE OR REPLACE FUNCTION public.fn_validate_and_snapshot_rental()
RETURNS trigger AS $$
DECLARE
    v_listing record;
    v_days int;
    v_blocked boolean;
BEGIN
    -- Fetch parent listing
    SELECT * INTO v_listing FROM public.listings WHERE id = NEW.listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing does not exist';
    END IF;

    IF v_listing.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Listing is not active';
    END IF;

    -- Ensure owner is strictly the listing owner
    NEW.owner_id := v_listing.owner_id;

    IF NEW.renter_id = NEW.owner_id THEN
        RAISE EXCEPTION 'Owner cannot rent their own item';
    END IF;

    -- Check if either user blocked the other
    SELECT EXISTS (
        SELECT 1 FROM public.blocks
        WHERE (blocker_id = NEW.renter_id AND blocked_id = NEW.owner_id)
           OR (blocker_id = NEW.owner_id AND blocked_id = NEW.renter_id)
    ) INTO v_blocked;

    IF v_blocked THEN
        RAISE EXCEPTION 'Cannot create rental request due to user block';
    END IF;

    -- Compute duration in days inclusive: [start_date, end_date]
    v_days := (NEW.end_date - NEW.start_date) + 1;
    IF v_days < 1 THEN
        RAISE EXCEPTION 'End date must be on or after start date';
    END IF;

    IF v_listing.max_rental_days IS NOT NULL AND v_days > v_listing.max_rental_days THEN
        RAISE EXCEPTION 'Rental duration exceeds listing maximum of % days', v_listing.max_rental_days;
    END IF;

    -- Snapshot price from database listing record (never trust client)
    NEW.days := v_days;
    NEW.price_per_day := v_listing.price_per_day;
    NEW.rental_amount := v_days * v_listing.price_per_day;
    NEW.security_deposit := 0;
    NEW.platform_fee := 0;
    NEW.total_amount := NEW.rental_amount;
    NEW.expires_at := now() + interval '48 hours';
    NEW.updated_at := now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_and_snapshot_rental ON public.rentals;
CREATE TRIGGER trg_validate_and_snapshot_rental
BEFORE INSERT ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_and_snapshot_rental();

-- 9b. Prevent Overlapping Active Bookings
CREATE OR REPLACE FUNCTION public.fn_prevent_overlapping_rentals()
RETURNS trigger AS $$
DECLARE
    v_overlap_exists boolean;
BEGIN
    -- Only check if this rental is in an active/booked state
    IF NEW.status IN (
        'ACCEPTED',
        'PAYMENT_PENDING',
        'CONFIRMED',
        'PICKUP_DELIVERY_PENDING',
        'ITEM_PICKED_UP',
        'RENTAL_ACTIVE',
        'RETURN_REQUESTED',
        'RETURN_DELIVERY'
    ) THEN
        SELECT EXISTS (
            SELECT 1 FROM public.rentals
            WHERE listing_id = NEW.listing_id
              AND id <> NEW.id
              AND status IN (
                  'ACCEPTED',
                  'PAYMENT_PENDING',
                  'CONFIRMED',
                  'PICKUP_DELIVERY_PENDING',
                  'ITEM_PICKED_UP',
                  'RENTAL_ACTIVE',
                  'RETURN_REQUESTED',
                  'RETURN_DELIVERY'
              )
              AND (start_date <= NEW.end_date AND end_date >= NEW.start_date)
        ) INTO v_overlap_exists;

        IF v_overlap_exists THEN
            RAISE EXCEPTION 'Overlapping booking exists for this item on the selected dates';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_overlapping_rentals ON public.rentals;
CREATE TRIGGER trg_prevent_overlapping_rentals
BEFORE INSERT OR UPDATE OF status, start_date, end_date ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_overlapping_rentals();

-- 9c. Enforce Database-Level Status Transitions & Event Logging
/*
ALLOWED STATUS TRANSITIONS MATRIX:
-------------------------------------------------------------------------------
From Status               To Status                 Permitted Actor
-------------------------------------------------------------------------------
(NEW INSERT)              REQUESTED                 Renter
REQUESTED                 ACCEPTED                  Owner
REQUESTED                 REJECTED                  Owner
REQUESTED                 CANCELLED                 Renter or Owner
REQUESTED                 EXPIRED                   System / Either party (if >48h)
ACCEPTED                  PAYMENT_PENDING           Owner or Renter
ACCEPTED                  CONFIRMED                 Owner or Renter
ACCEPTED                  CANCELLED                 Renter or Owner
PAYMENT_PENDING           CONFIRMED                 Owner or Renter
PAYMENT_PENDING           CANCELLED                 Renter or Owner
CONFIRMED                 PICKUP_DELIVERY_PENDING   Owner or Renter
CONFIRMED                 ITEM_PICKED_UP            Owner or Renter
CONFIRMED                 CANCELLED                 Renter or Owner
PICKUP_DELIVERY_PENDING   ITEM_PICKED_UP            Owner or Renter
PICKUP_DELIVERY_PENDING   CANCELLED                 Renter or Owner
ITEM_PICKED_UP            RENTAL_ACTIVE             Owner or Renter
RENTAL_ACTIVE             RETURN_REQUESTED          Renter
RENTAL_ACTIVE             RETURN_DELIVERY           Renter or Owner
RENTAL_ACTIVE             OVERDUE                   System / Owner (if past end_date)
RENTAL_ACTIVE             DISPUTED                  Renter or Owner
RENTAL_ACTIVE             DAMAGED_REVIEW            Owner
RETURN_REQUESTED          RETURN_DELIVERY           Renter or Owner
RETURN_REQUESTED          RETURNED                  Owner
RETURN_REQUESTED          DISPUTED                  Renter or Owner
RETURN_REQUESTED          DAMAGED_REVIEW            Owner
RETURN_DELIVERY           RETURNED                  Owner
RETURN_DELIVERY           DISPUTED                  Renter or Owner
RETURNED                  COMPLETED                 Owner or Renter
RETURNED                  DAMAGED_REVIEW            Owner
RETURNED                  DISPUTED                  Renter or Owner
DAMAGED_REVIEW            DISPUTED                  Renter or Owner
DAMAGED_REVIEW            COMPLETED                 Owner
DISPUTED                  COMPLETED                 Owner or Renter
DISPUTED                  CANCELLED                 Owner or Renter
-------------------------------------------------------------------------------
*/

CREATE OR REPLACE FUNCTION public.fn_enforce_rental_status_transition()
RETURNS trigger AS $$
DECLARE
    v_actor uuid;
    v_is_renter boolean;
    v_is_owner boolean;
    v_is_valid boolean := false;
BEGIN
    NEW.updated_at := now();

    -- On initial creation:
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.rental_status_events (rental_id, from_status, to_status, changed_by, note)
        VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'Rental request created');

        -- Create notification for owner
        INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (
            NEW.owner_id,
            'RENTAL_REQUESTED',
            'New Rental Request',
            'Someone requested to rent your item.',
            '/orders/' || NEW.id::text
        );
        RETURN NEW;
    END IF;

    -- If status did not change, allow update (e.g. payment_status update)
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    v_actor := auth.uid();
    v_is_renter := (v_actor = NEW.renter_id);
    v_is_owner := (v_actor = NEW.owner_id);

    -- Validate Transitions
    IF OLD.status = 'REQUESTED' THEN
        IF NEW.status = 'ACCEPTED' AND (v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'REJECTED' AND (v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'EXPIRED' THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'ACCEPTED' THEN
        IF NEW.status IN ('PAYMENT_PENDING', 'CONFIRMED') AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'PAYMENT_PENDING' THEN
        IF NEW.status = 'CONFIRMED' AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'CONFIRMED' THEN
        IF NEW.status IN ('PICKUP_DELIVERY_PENDING', 'ITEM_PICKED_UP') AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'PICKUP_DELIVERY_PENDING' THEN
        IF NEW.status = 'ITEM_PICKED_UP' AND (v_is_owner OR v_is_renter OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'ITEM_PICKED_UP' THEN
        IF NEW.status = 'RENTAL_ACTIVE' AND (v_is_owner OR v_is_renter OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'RENTAL_ACTIVE' THEN
        IF NEW.status IN ('RETURN_REQUESTED', 'RETURN_DELIVERY') AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'OVERDUE' THEN v_is_valid := true;
        ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'DAMAGED_REVIEW' AND (v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'RETURN_REQUESTED' THEN
        IF NEW.status IN ('RETURN_DELIVERY', 'RETURNED') AND (v_is_owner OR v_is_renter OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'DAMAGED_REVIEW' AND (v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'RETURN_DELIVERY' THEN
        IF NEW.status = 'RETURNED' AND (v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'RETURNED' THEN
        IF NEW.status = 'COMPLETED' AND (v_is_owner OR v_is_renter OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'DAMAGED_REVIEW' AND (v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'DAMAGED_REVIEW' THEN
        IF NEW.status IN ('DISPUTED', 'COMPLETED') AND (v_is_owner OR v_is_renter OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;

    ELSIF OLD.status = 'DISPUTED' THEN
        IF NEW.status IN ('COMPLETED', 'CANCELLED') AND (v_is_owner OR v_is_renter OR v_actor IS NULL) THEN v_is_valid := true;
        END IF;
    END IF;

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Invalid status transition from % to % for this user', OLD.status, NEW.status;
    END IF;

    -- Record status event audit trail
    INSERT INTO public.rental_status_events (rental_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, v_actor, 'Status changed to ' || NEW.status);

    -- Notify the opposing party
    DECLARE
        v_recipient uuid;
    BEGIN
        IF v_actor = NEW.renter_id THEN
            v_recipient := NEW.owner_id;
        ELSE
            v_recipient := NEW.renter_id;
        END IF;

        IF v_recipient IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, type, title, body, link)
            VALUES (
                v_recipient,
                'RENTAL_STATUS_' || NEW.status,
                'Rental Status Updated',
                'Your rental status changed to ' || replace(NEW.status, '_', ' '),
                '/orders/' || NEW.id::text
            );
        END IF;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_rental_status_transition ON public.rentals;
CREATE TRIGGER trg_enforce_rental_status_transition
BEFORE UPDATE OF status ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_rental_status_transition();

-- 9d. Lazy Expiration Function for 48h Rental Requests
CREATE OR REPLACE FUNCTION public.expire_stale_rental_requests()
RETURNS int AS $$
DECLARE
    v_count int;
BEGIN
    UPDATE public.rentals
    SET status = 'EXPIRED'
    WHERE status = 'REQUESTED' AND expires_at < now();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9e. Chat Blocking & Notification Enforcement
CREATE OR REPLACE FUNCTION public.fn_check_message_before_insert()
RETURNS trigger AS $$
DECLARE
    v_conv record;
    v_recipient uuid;
    v_blocked boolean;
BEGIN
    SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found';
    END IF;

    IF NEW.sender_id = v_conv.renter_id THEN
        v_recipient := v_conv.owner_id;
    ELSIF NEW.sender_id = v_conv.owner_id THEN
        v_recipient := v_conv.renter_id;
    ELSE
        RAISE EXCEPTION 'Sender is not a participant in this conversation';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.blocks
        WHERE (blocker_id = v_recipient AND blocked_id = NEW.sender_id)
           OR (blocker_id = NEW.sender_id AND blocked_id = v_recipient)
    ) INTO v_blocked;

    IF v_blocked THEN
        RAISE EXCEPTION 'Cannot send message: user is blocked';
    END IF;

    -- Update conversation updated_at
    UPDATE public.conversations SET updated_at = now() WHERE id = v_conv.id;

    -- Trigger notification to recipient
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
        v_recipient,
        'NEW_MESSAGE',
        'New Message',
        substring(NEW.body from 1 for 60),
        '/messages/' || v_conv.id::text
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_message_before_insert ON public.messages;
CREATE TRIGGER trg_check_message_before_insert
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.fn_check_message_before_insert();

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 10a. Blocks
DROP POLICY IF EXISTS "blocks_select_own" ON public.blocks;
CREATE POLICY "blocks_select_own" ON public.blocks
    FOR SELECT USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_insert_own" ON public.blocks;
CREATE POLICY "blocks_insert_own" ON public.blocks
    FOR INSERT WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_delete_own" ON public.blocks;
CREATE POLICY "blocks_delete_own" ON public.blocks
    FOR DELETE USING (auth.uid() = blocker_id);

-- 10b. Reports
DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports
    FOR SELECT USING (auth.uid() = reporter_id);

-- 10c. Rentals
DROP POLICY IF EXISTS "rentals_select_participants" ON public.rentals;
CREATE POLICY "rentals_select_participants" ON public.rentals
    FOR SELECT USING (auth.uid() = renter_id OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "rentals_insert_renter" ON public.rentals;
CREATE POLICY "rentals_insert_renter" ON public.rentals
    FOR INSERT WITH CHECK (auth.uid() = renter_id);

DROP POLICY IF EXISTS "rentals_update_participants" ON public.rentals;
CREATE POLICY "rentals_update_participants" ON public.rentals
    FOR UPDATE USING (auth.uid() = renter_id OR auth.uid() = owner_id)
    WITH CHECK (auth.uid() = renter_id OR auth.uid() = owner_id);

-- 10d. Rental Status Events
DROP POLICY IF EXISTS "events_select_participants" ON public.rental_status_events;
CREATE POLICY "events_select_participants" ON public.rental_status_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.rentals r
            WHERE r.id = rental_id AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
        )
    );

-- 10e. Rental Evidence
DROP POLICY IF EXISTS "evidence_select_participants" ON public.rental_evidence;
CREATE POLICY "evidence_select_participants" ON public.rental_evidence
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.rentals r
            WHERE r.id = rental_id AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "evidence_insert_participants" ON public.rental_evidence;
CREATE POLICY "evidence_insert_participants" ON public.rental_evidence
    FOR INSERT WITH CHECK (
        auth.uid() = created_by AND
        EXISTS (
            SELECT 1 FROM public.rentals r
            WHERE r.id = rental_id AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
        )
    );

-- 10f. Conversations
DROP POLICY IF EXISTS "conversations_select_participants" ON public.conversations;
CREATE POLICY "conversations_select_participants" ON public.conversations
    FOR SELECT USING (auth.uid() = renter_id OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "conversations_insert_renter" ON public.conversations;
CREATE POLICY "conversations_insert_renter" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = renter_id OR auth.uid() = owner_id);

-- 10g. Messages
DROP POLICY IF EXISTS "messages_select_participants" ON public.messages;
CREATE POLICY "messages_select_participants" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND (c.renter_id = auth.uid() OR c.owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "messages_insert_participants" ON public.messages;
CREATE POLICY "messages_insert_participants" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND (c.renter_id = auth.uid() OR c.owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "messages_update_reader" ON public.messages;
CREATE POLICY "messages_update_reader" ON public.messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND (c.renter_id = auth.uid() OR c.owner_id = auth.uid())
        )
    );

-- 10h. Notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 10i. Storage Policies for "rental-evidence"
DROP POLICY IF EXISTS "evidence_storage_read" ON storage.objects;
CREATE POLICY "evidence_storage_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'rental-evidence' AND
        EXISTS (
            SELECT 1 FROM public.rentals r
            WHERE r.id::text = (storage.foldername(name))[1]
              AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "evidence_storage_insert" ON storage.objects;
CREATE POLICY "evidence_storage_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'rental-evidence' AND
        EXISTS (
            SELECT 1 FROM public.rentals r
            WHERE r.id::text = (storage.foldername(name))[1]
              AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
        )
    );

-- ------------------------------------------------------------------------------
-- 11. SUPABASE REALTIME REPLICATION
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication
    END;
END $$;

-- ==============================================================================
-- END OF PHASE 3 MIGRATION
-- ==============================================================================
