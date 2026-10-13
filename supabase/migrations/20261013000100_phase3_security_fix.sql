-- ==============================================================================
-- PHASE 3 SECURITY HARDENED MIGRATION
-- File: supabase/migrations/20261013000100_phase3_security_fix.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & STORAGE BUCKET
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Private storage bucket for rental handover & return evidence photos
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

-- FIX 1 & 9: Rental INSERT Validation
-- Force status = 'REQUESTED'; renter_id must equal auth.uid() (reject otherwise)
-- Snapshot pricing and owner strictly from database record
CREATE OR REPLACE FUNCTION public.fn_validate_and_snapshot_rental()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_listing record;
    v_days int;
    v_blocked boolean;
    v_auth_user uuid;
BEGIN
    v_auth_user := auth.uid();
    IF v_auth_user IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a rental request';
    END IF;

    -- FIX 1: renter_id must equal auth.uid()
    IF NEW.renter_id IS DISTINCT FROM v_auth_user THEN
        RAISE EXCEPTION 'renter_id must match the authenticated user';
    END IF;

    -- FIX 1: Force status = 'REQUESTED' regardless of input
    NEW.status := 'REQUESTED';
    NEW.payment_status := 'PENDING';

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
    NEW.created_at := now();
    NEW.updated_at := now();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_and_snapshot_rental ON public.rentals;
CREATE TRIGGER trg_validate_and_snapshot_rental
BEFORE INSERT ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_and_snapshot_rental();

-- FIX 2 & 3 & 9: Lock money, identity, dates, and non-status columns on rentals
CREATE OR REPLACE FUNCTION public.fn_lock_rental_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- FIX 2: Lock money, identity, and dates
    IF NEW.listing_id IS DISTINCT FROM OLD.listing_id OR
       NEW.renter_id IS DISTINCT FROM OLD.renter_id OR
       NEW.owner_id IS DISTINCT FROM OLD.owner_id OR
       NEW.days IS DISTINCT FROM OLD.days OR
       NEW.price_per_day IS DISTINCT FROM OLD.price_per_day OR
       NEW.rental_amount IS DISTINCT FROM OLD.rental_amount OR
       NEW.security_deposit IS DISTINCT FROM OLD.security_deposit OR
       NEW.platform_fee IS DISTINCT FROM OLD.platform_fee OR
       NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
       NEW.start_date IS DISTINCT FROM OLD.start_date OR
       NEW.end_date IS DISTINCT FROM OLD.end_date THEN
        RAISE EXCEPTION 'Cannot modify locked identity, pricing, or rental date columns';
    END IF;

    -- FIX 3: Restrict UPDATE on rentals to status, payment_status, and updated_at only
    IF NEW.fulfillment IS DISTINCT FROM OLD.fulfillment OR
       NEW.message IS DISTINCT FROM OLD.message OR
       NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
       NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Only status and payment_status may be updated on rentals';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_rental_columns ON public.rentals;
CREATE TRIGGER trg_lock_rental_columns
BEFORE UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.fn_lock_rental_immutable_columns();

-- Overlapping active rentals prevention trigger
CREATE OR REPLACE FUNCTION public.fn_prevent_overlapping_rentals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_overlap_exists boolean;
BEGIN
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
$$;

DROP TRIGGER IF EXISTS trg_prevent_overlapping_rentals ON public.rentals;
CREATE TRIGGER trg_prevent_overlapping_rentals
BEFORE INSERT OR UPDATE OF status, start_date, end_date ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_overlapping_rentals();

-- FIX 3 & 8 & 9: Enforce Status Transitions, Check Ownership, Never allow v_actor IS NULL except service role
CREATE OR REPLACE FUNCTION public.fn_enforce_rental_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid;
    v_is_renter boolean;
    v_is_owner boolean;
    v_is_service_role boolean;
    v_is_valid boolean := false;
    v_recipient uuid;
BEGIN
    NEW.updated_at := now();

    -- On initial creation:
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.rental_status_events (rental_id, from_status, to_status, changed_by, note)
        VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'Rental request created');

        -- FIX 8: Safe notification with fixed text
        INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (
            NEW.owner_id,
            'RENTAL_REQUESTED',
            'New Rental Request',
            'A student requested to rent one of your items.',
            '/orders/' || NEW.id::text
        );
        RETURN NEW;
    END IF;

    -- If status did not change, allow update only if payment_status changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    v_actor := auth.uid();
    v_is_service_role := (current_setting('role', true) = 'service_role');

    -- FIX 3: Never allow v_actor IS NULL except for the expiry/system job running as service_role
    IF v_actor IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Unauthorized: Status changes require authenticated user';
    END IF;

    v_is_renter := (v_actor = NEW.renter_id);
    v_is_owner := (v_actor = NEW.owner_id);

    -- Service-role automated transitions (expiry/overdue only)
    IF v_is_service_role THEN
        IF OLD.status = 'REQUESTED' AND NEW.status = 'EXPIRED' THEN
            v_is_valid := true;
        ELSIF OLD.status = 'RENTAL_ACTIVE' AND NEW.status = 'OVERDUE' THEN
            v_is_valid := true;
        ELSE
            RAISE EXCEPTION 'Service role can only transition stale rentals to EXPIRED or OVERDUE';
        END IF;
    END IF;

    -- User-driven transitions
    IF NOT v_is_valid AND v_actor IS NOT NULL THEN
        -- REQUESTED transitions
        IF OLD.status = 'REQUESTED' THEN
            IF NEW.status = 'ACCEPTED' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'REJECTED' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'EXPIRED' AND (v_is_renter OR v_is_owner) AND (now() > OLD.expires_at) THEN v_is_valid := true;
            END IF;

        -- ACCEPTED transitions
        ELSIF OLD.status = 'ACCEPTED' THEN
            IF NEW.status IN ('PAYMENT_PENDING', 'CONFIRMED') AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- PAYMENT_PENDING transitions
        ELSIF OLD.status = 'PAYMENT_PENDING' THEN
            IF NEW.status = 'CONFIRMED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- CONFIRMED transitions
        ELSIF OLD.status = 'CONFIRMED' THEN
            IF NEW.status IN ('PICKUP_DELIVERY_PENDING', 'ITEM_PICKED_UP') AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- PICKUP_DELIVERY_PENDING transitions
        ELSIF OLD.status = 'PICKUP_DELIVERY_PENDING' THEN
            IF NEW.status = 'ITEM_PICKED_UP' AND (v_is_owner OR v_is_renter) THEN v_is_valid := true;
            ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- ITEM_PICKED_UP transitions
        ELSIF OLD.status = 'ITEM_PICKED_UP' THEN
            IF NEW.status = 'RENTAL_ACTIVE' AND (v_is_owner OR v_is_renter) THEN v_is_valid := true;
            END IF;

        -- RENTAL_ACTIVE transitions
        ELSIF OLD.status = 'RENTAL_ACTIVE' THEN
            -- FIX 3: Renter-only must check renter
            IF NEW.status = 'RETURN_REQUESTED' AND v_is_renter THEN v_is_valid := true;
            ELSIF NEW.status = 'RETURN_DELIVERY' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'OVERDUE' AND (v_is_owner AND now() > NEW.end_date) THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            -- FIX 3: Owner-only must check owner
            ELSIF NEW.status = 'DAMAGED_REVIEW' AND v_is_owner THEN v_is_valid := true;
            END IF;

        -- RETURN_REQUESTED transitions
        ELSIF OLD.status = 'RETURN_REQUESTED' THEN
            IF NEW.status = 'RETURN_DELIVERY' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            -- FIX 3: Owner-only confirms return
            ELSIF NEW.status = 'RETURNED' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            -- FIX 3: Owner-only flags damaged review
            ELSIF NEW.status = 'DAMAGED_REVIEW' AND v_is_owner THEN v_is_valid := true;
            END IF;

        -- RETURN_DELIVERY transitions
        ELSIF OLD.status = 'RETURN_DELIVERY' THEN
            -- FIX 3: Owner-only confirms return
            IF NEW.status = 'RETURNED' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- RETURNED transitions
        ELSIF OLD.status = 'RETURNED' THEN
            IF NEW.status = 'COMPLETED' AND (v_is_owner OR v_is_renter) THEN v_is_valid := true;
            -- FIX 3: Owner-only flags damaged review
            ELSIF NEW.status = 'DAMAGED_REVIEW' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- DAMAGED_REVIEW transitions
        ELSIF OLD.status = 'DAMAGED_REVIEW' THEN
            IF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            -- FIX 3: Owner-only marks completed after damage review
            ELSIF NEW.status = 'COMPLETED' AND v_is_owner THEN v_is_valid := true;
            END IF;

        -- DISPUTED transitions
        ELSIF OLD.status = 'DISPUTED' THEN
            IF NEW.status IN ('COMPLETED', 'CANCELLED') AND (v_is_owner OR v_is_renter) THEN v_is_valid := true;
            END IF;
        END IF;
    END IF;

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Invalid status transition from % to % for user %', OLD.status, NEW.status, coalesce(v_actor::text, 'service_role');
    END IF;

    -- Audit trail event logging
    INSERT INTO public.rental_status_events (rental_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, v_actor, 'Status changed to ' || NEW.status);

    -- FIX 8: Safe notification with fixed text
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
            'Your rental status changed to ' || replace(NEW.status, '_', ' ') || '.',
            '/orders/' || NEW.id::text
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_rental_status_transition ON public.rentals;
CREATE TRIGGER trg_enforce_rental_status_transition
BEFORE UPDATE OF status ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_rental_status_transition();

-- FIX 4 & 9: Expiration function executable ONLY by service_role
CREATE OR REPLACE FUNCTION public.expire_stale_rental_requests()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count int;
BEGIN
    UPDATE public.rentals
    SET status = 'EXPIRED'
    WHERE status = 'REQUESTED' AND expires_at < now();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- FIX 4: Revoke from PUBLIC, authenticated, anon; grant only to service_role
REVOKE ALL ON FUNCTION public.expire_stale_rental_requests() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_rental_requests() TO service_role;

-- FIX 6 & 9: Conversations insertion validation
CREATE OR REPLACE FUNCTION public.fn_validate_conversation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_listing_owner uuid;
BEGIN
    -- FIX 6: Only the renter may insert
    IF NEW.renter_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the authenticated renter may initiate a conversation';
    END IF;

    SELECT owner_id INTO v_listing_owner FROM public.listings WHERE id = NEW.listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing does not exist';
    END IF;

    -- FIX 6: owner_id must match the listing's owner
    IF NEW.owner_id IS DISTINCT FROM v_listing_owner THEN
        NEW.owner_id := v_listing_owner;
    END IF;

    IF NEW.renter_id = NEW.owner_id THEN
        RAISE EXCEPTION 'Cannot start a conversation with yourself';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_conversation_insert ON public.conversations;
CREATE TRIGGER trg_validate_conversation_insert
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_conversation_insert();

-- FIX 5 & 9: Messages immutable body and sender_id trigger
CREATE OR REPLACE FUNCTION public.fn_lock_message_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- FIX 5: block changes to body, sender_id, conversation_id, created_at
    IF NEW.body IS DISTINCT FROM OLD.body OR
       NEW.sender_id IS DISTINCT FROM OLD.sender_id OR
       NEW.conversation_id IS DISTINCT FROM OLD.conversation_id OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Message content and sender cannot be altered. Only read_at may be updated.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_message_columns ON public.messages;
CREATE TRIGGER trg_lock_message_columns
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.fn_lock_message_immutable_columns();

-- FIX 8 & 9: Messages before insert with safe notification text
CREATE OR REPLACE FUNCTION public.fn_check_message_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conv record;
    v_recipient uuid;
    v_blocked boolean;
    v_safe_body text;
BEGIN
    IF NEW.sender_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Sender ID must match authenticated user';
    END IF;

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

    -- Update conversation timestamp
    UPDATE public.conversations SET updated_at = now() WHERE id = v_conv.id;

    -- FIX 8: Safe notification with fixed title and sanitized truncated body
    v_safe_body := substring(regexp_replace(NEW.body, '[\r\n\t]+', ' ', 'g') from 1 for 60);

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
        v_recipient,
        'NEW_MESSAGE',
        'New Message Received',
        v_safe_body,
        '/messages/' || v_conv.id::text
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_message_before_insert ON public.messages;
CREATE TRIGGER trg_check_message_before_insert
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.fn_check_message_before_insert();

-- FIX 7 & 9: Evidence insert validation requiring active or return rental status
CREATE OR REPLACE FUNCTION public.fn_validate_rental_evidence_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rental record;
BEGIN
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Evidence created_by must match authenticated user';
    END IF;

    SELECT * INTO v_rental FROM public.rentals WHERE id = NEW.rental_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rental does not exist';
    END IF;

    IF NEW.created_by <> v_rental.renter_id AND NEW.created_by <> v_rental.owner_id THEN
        RAISE EXCEPTION 'Only rental participants can submit evidence';
    END IF;

    -- FIX 7: Require rental status in allowed active/return states
    IF v_rental.status NOT IN (
        'ITEM_PICKED_UP',
        'RENTAL_ACTIVE',
        'RETURN_REQUESTED',
        'RETURN_DELIVERY',
        'RETURNED',
        'DAMAGED_REVIEW'
    ) THEN
        RAISE EXCEPTION 'Evidence can only be uploaded when rental is active or in return flow (current status: %)', v_rental.status;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_rental_evidence_insert ON public.rental_evidence;
CREATE TRIGGER trg_validate_rental_evidence_insert
BEFORE INSERT ON public.rental_evidence
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_rental_evidence_insert();

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

-- FIX 1: renter_id must match auth.uid()
DROP POLICY IF EXISTS "rentals_insert_renter" ON public.rentals;
CREATE POLICY "rentals_insert_renter" ON public.rentals
    FOR INSERT WITH CHECK (auth.uid() = renter_id);

-- Update permitted only to participants (locked columns guarded by trigger)
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

-- FIX 7: RLS check requiring rental status in allowed active/return states
DROP POLICY IF EXISTS "evidence_insert_participants" ON public.rental_evidence;
CREATE POLICY "evidence_insert_participants" ON public.rental_evidence
    FOR INSERT WITH CHECK (
        auth.uid() = created_by AND
        EXISTS (
            SELECT 1 FROM public.rentals r
            WHERE r.id = rental_id
              AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
              AND r.status IN ('ITEM_PICKED_UP', 'RENTAL_ACTIVE', 'RETURN_REQUESTED', 'RETURN_DELIVERY', 'RETURNED', 'DAMAGED_REVIEW')
        )
    );

-- 10f. Conversations
DROP POLICY IF EXISTS "conversations_select_participants" ON public.conversations;
CREATE POLICY "conversations_select_participants" ON public.conversations
    FOR SELECT USING (auth.uid() = renter_id OR auth.uid() = owner_id);

-- FIX 6: Only the renter may insert, and owner_id must match the listing's owner
DROP POLICY IF EXISTS "conversations_insert_renter" ON public.conversations;
CREATE POLICY "conversations_insert_renter" ON public.conversations
    FOR INSERT WITH CHECK (
        auth.uid() = renter_id AND
        owner_id = (SELECT owner_id FROM public.listings WHERE id = listing_id) AND
        renter_id <> owner_id
    );

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

-- FIX 5: No update policy on messages EXCEPT for recipient updating read_at
DROP POLICY IF EXISTS "messages_update_reader" ON public.messages;
DROP POLICY IF EXISTS "messages_update_read_at" ON public.messages;
CREATE POLICY "messages_update_read_at" ON public.messages
    FOR UPDATE USING (
        auth.uid() <> sender_id AND
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND (c.renter_id = auth.uid() OR c.owner_id = auth.uid())
        )
    )
    WITH CHECK (
        auth.uid() <> sender_id AND
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
              AND r.status IN ('ITEM_PICKED_UP', 'RENTAL_ACTIVE', 'RETURN_REQUESTED', 'RETURN_DELIVERY', 'RETURNED', 'DAMAGED_REVIEW')
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
-- END OF PHASE 3 SECURITY HARDENED MIGRATION
-- ==============================================================================
