-- ==============================================================================
-- PHASE 3 COMPLETE DATABASE SETUP
-- Migration: 20261013000300_phase3_complete.sql
--
-- DECISIONS & ENFORCEMENT SUMMARY:
-- 1. Pending (REQUESTED) requests MAY overlap each other; overlap is only checked
--    against ACCEPTED-or-later active booking statuses.
-- 2. When owner accepts a request (REQUESTED -> ACCEPTED), every other REQUESTED
--    rental for the same listing with overlapping dates is automatically updated
--    to REJECTED with rejection_reason 'Item no longer available for these dates',
--    generating one audit event row and one notification via the owner's transition.
-- 3. Only owner (or service_role) can transition payment_status PENDING -> PAID,
--    and only when status IN ('ACCEPTED','PAYMENT_PENDING','CONFIRMED',
--    'ITEM_PICKED_UP','RENTAL_ACTIVE','RETURNED','COMPLETED'). Renter may only set payment_method.
-- 4. Rental evidence is IMMUTABLE: insert only. No update/delete grants, policies or triggers.
-- 5. Money, identity, and date columns on rentals are locked after insert.
-- 6. Expiry of stale REQUESTED rentals is restricted exclusively to service_role.
-- 7. The auto-reject path has been verified by the test checks in supabase/tests/phase3_checks.sql.
--
-- ALLOWED STATUS TRANSITIONS TABLE:
-- - REQUESTED -> ACCEPTED (owner)
-- - REQUESTED -> REJECTED (owner)
-- - REQUESTED -> CANCELLED (renter or owner)
-- - ACCEPTED -> PAYMENT_PENDING or CONFIRMED (renter or owner)
-- - ACCEPTED -> CANCELLED (renter or owner)
-- - PAYMENT_PENDING -> CONFIRMED (renter or owner)
-- - PAYMENT_PENDING -> CANCELLED (renter or owner)
-- - CONFIRMED -> PICKUP_DELIVERY_PENDING or ITEM_PICKED_UP (renter or owner)
-- - CONFIRMED -> CANCELLED (renter or owner)
-- - PICKUP_DELIVERY_PENDING -> ITEM_PICKED_UP (renter or owner)
-- - PICKUP_DELIVERY_PENDING -> CANCELLED (renter or owner)
-- - ITEM_PICKED_UP -> RENTAL_ACTIVE (renter or owner)
-- - RENTAL_ACTIVE -> RETURN_REQUESTED (renter only)
-- - RENTAL_ACTIVE -> RETURN_DELIVERY (renter or owner)
-- - RENTAL_ACTIVE -> DISPUTED (renter or owner)
-- - RENTAL_ACTIVE -> DAMAGED_REVIEW (owner only)
-- - RENTAL_ACTIVE -> OVERDUE (service_role only)
-- - RETURN_REQUESTED -> RETURN_DELIVERY (renter or owner)
-- - RETURN_REQUESTED -> RETURNED (owner only)
-- - RETURN_REQUESTED -> DISPUTED (renter or owner)
-- - RETURN_REQUESTED -> DAMAGED_REVIEW (owner only)
-- - RETURN_DELIVERY -> RETURNED (owner only)
-- - RETURN_DELIVERY -> DISPUTED (renter or owner)
-- - RETURNED -> COMPLETED (renter or owner)
-- - RETURNED -> DAMAGED_REVIEW (owner only)
-- - RETURNED -> DISPUTED (renter or owner)
-- - DAMAGED_REVIEW -> DISPUTED (renter or owner)
-- - DAMAGED_REVIEW -> COMPLETED (owner only)
-- - DISPUTED -> COMPLETED (renter or owner)
-- - DISPUTED -> CANCELLED (renter or owner)
-- - REQUESTED -> EXPIRED (service_role only)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.blocks (
    blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT chk_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type text NOT NULL CHECK (target_type IN ('USER', 'LISTING')),
    target_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rentals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    renter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days integer NOT NULL CHECK (days >= 1),
    price_per_day numeric NOT NULL CHECK (price_per_day >= 10),
    rental_amount numeric NOT NULL CHECK (rental_amount >= 0),
    security_deposit numeric NOT NULL DEFAULT 0 CHECK (security_deposit = 0),
    platform_fee numeric NOT NULL DEFAULT 0 CHECK (platform_fee = 0),
    total_amount numeric NOT NULL CHECK (total_amount >= 0),
    fulfillment text NOT NULL CHECK (fulfillment IN ('PICKUP', 'DELIVERY')),
    message text CHECK (char_length(message) <= 500),
    payment_method text NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'UPI')),
    payment_status text NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
        'REQUESTED', 'ACCEPTED', 'PAYMENT_PENDING', 'CONFIRMED',
        'PICKUP_DELIVERY_PENDING', 'ITEM_PICKED_UP', 'RENTAL_ACTIVE',
        'RETURN_REQUESTED', 'RETURN_DELIVERY', 'RETURNED', 'COMPLETED',
        'REJECTED', 'CANCELLED', 'EXPIRED', 'OVERDUE', 'DISPUTED', 'DAMAGED_REVIEW'
    )),
    rejection_reason text,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_rentals_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_rentals_parties CHECK (renter_id <> owner_id)
);

ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE IF NOT EXISTS public.rental_status_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
    from_status text,
    to_status text NOT NULL,
    changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_evidence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('HANDOVER', 'RETURN')),
    photo_paths text[] NOT NULL DEFAULT '{}',
    condition_notes text,
    damage_notes text,
    created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

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
-- 2. INDEXES
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_rentals_listing_status ON public.rentals(listing_id, status);
CREATE INDEX IF NOT EXISTS idx_rentals_renter_status ON public.rentals(renter_id, status);
CREATE INDEX IF NOT EXISTS idx_rentals_owner_status ON public.rentals(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_rentals_dates ON public.rentals(listing_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rental_status_events_rental ON public.rental_status_events(rental_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rental_evidence_rental ON public.rental_evidence(rental_id, type);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(renter_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read_at, created_at);

-- ------------------------------------------------------------------------------
-- 3. RENTAL INSERT TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_validate_and_snapshot_rental()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_listing record;
    v_days integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a rental request';
    END IF;

    IF NEW.renter_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'renter_id must match the authenticated user (%)', auth.uid();
    END IF;

    -- Fetch parent listing
    SELECT * INTO v_listing FROM public.listings WHERE id = NEW.listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing does not exist';
    END IF;

    IF v_listing.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Listing is not active';
    END IF;

    -- Set owner from listing
    NEW.owner_id := v_listing.owner_id;

    IF NEW.renter_id = NEW.owner_id THEN
        RAISE EXCEPTION 'Cannot rent your own listing';
    END IF;

    -- Block check
    IF EXISTS (
        SELECT 1 FROM public.blocks
        WHERE (blocker_id = NEW.owner_id AND blocked_id = NEW.renter_id)
           OR (blocker_id = NEW.renter_id AND blocked_id = NEW.owner_id)
    ) THEN
        RAISE EXCEPTION 'Unable to request rental due to user block';
    END IF;

    -- Date logic
    IF NEW.start_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Start date cannot be in the past';
    END IF;

    IF NEW.end_date < NEW.start_date THEN
        RAISE EXCEPTION 'End date must be greater than or equal to start date';
    END IF;

    v_days := (NEW.end_date - NEW.start_date) + 1;
    IF v_listing.max_rental_days IS NOT NULL AND v_days > v_listing.max_rental_days THEN
        RAISE EXCEPTION 'Rental duration exceeds maximum allowed days (%)', v_listing.max_rental_days;
    END IF;

    -- Server-side pricing snapshot
    NEW.days := v_days;
    NEW.price_per_day := v_listing.price_per_day;
    NEW.rental_amount := v_days * v_listing.price_per_day;
    NEW.security_deposit := 0;
    NEW.platform_fee := 0;
    NEW.total_amount := NEW.rental_amount;

    -- Force initial status and expiry
    NEW.status := 'REQUESTED';
    NEW.payment_status := 'PENDING';
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

-- ------------------------------------------------------------------------------
-- 4. RENTAL UPDATE LOCK TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_lock_rental_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Locked money, identity, date and request metadata
    IF NEW.listing_id IS DISTINCT FROM OLD.listing_id OR
       NEW.renter_id IS DISTINCT FROM OLD.renter_id OR
       NEW.owner_id IS DISTINCT FROM OLD.owner_id OR
       NEW.days IS DISTINCT FROM OLD.days OR
       NEW.price_per_day IS DISTINCT FROM OLD.price_per_day OR
       NEW.rental_amount IS DISTINCT FROM OLD.rental_amount OR
       NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
       NEW.security_deposit IS DISTINCT FROM OLD.security_deposit OR
       NEW.platform_fee IS DISTINCT FROM OLD.platform_fee OR
       NEW.start_date IS DISTINCT FROM OLD.start_date OR
       NEW.end_date IS DISTINCT FROM OLD.end_date OR
       NEW.fulfillment IS DISTINCT FROM OLD.fulfillment OR
       NEW.message IS DISTINCT FROM OLD.message OR
       NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Cannot modify locked rental identity, pricing, date, or metadata columns';
    END IF;

    -- Payment method changes permitted only by renter or owner (or service_role)
    IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
        IF auth.role() <> 'service_role' AND auth.uid() <> OLD.renter_id AND auth.uid() <> OLD.owner_id THEN
            RAISE EXCEPTION 'Unauthorized to change payment method';
        END IF;
    END IF;

    -- Payment status changes
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
        IF auth.role() = 'service_role' THEN
            NULL;
        ELSIF auth.uid() = OLD.owner_id AND OLD.payment_status = 'PENDING' AND NEW.payment_status = 'PAID' THEN
            IF OLD.status NOT IN (
                'ACCEPTED', 'PAYMENT_PENDING', 'CONFIRMED', 'ITEM_PICKED_UP',
                'RENTAL_ACTIVE', 'RETURNED', 'COMPLETED'
            ) THEN
                RAISE EXCEPTION 'Payment status can only be confirmed on active, confirmed, or completed statuses';
            END IF;
        ELSE
            RAISE EXCEPTION 'Unauthorized payment_status change: only owner may transition PENDING to PAID on valid rental statuses';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_rental_columns ON public.rentals;
CREATE TRIGGER trg_lock_rental_columns
BEFORE UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.fn_lock_rental_immutable_columns();

-- ------------------------------------------------------------------------------
-- 6. AUTO-REJECT HELPER (WITHOUT SESSION FLAGS)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_auto_reject_overlaps(
    p_listing_id uuid,
    p_accepted_id uuid,
    p_start_date date,
    p_end_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_other record;
BEGIN
    -- Lock listing row FOR UPDATE to serialize acceptance on the same item
    PERFORM 1 FROM public.listings WHERE id = p_listing_id FOR UPDATE;

    FOR v_other IN
        SELECT id FROM public.rentals
        WHERE listing_id = p_listing_id
          AND id <> p_accepted_id
          AND status = 'REQUESTED'
          AND (start_date <= p_end_date AND end_date >= p_start_date)
    LOOP
        -- Nested update executes through the transition trigger as the accepting owner
        UPDATE public.rentals
        SET status = 'REJECTED',
            rejection_reason = 'Item no longer available for these dates',
            updated_at = now()
        WHERE id = v_other.id;
    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_auto_reject_overlaps(uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. STATUS TRANSITION TRIGGER
-- ------------------------------------------------------------------------------

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
    v_event_note text;
    v_notif_body text;
BEGIN
    NEW.updated_at := now();

    -- On INSERT: record audit event and notify owner
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.rental_status_events (rental_id, from_status, to_status, changed_by, note)
        VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'Rental request created');

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

    -- If status did not change, allow update (e.g. payment_status update)
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    v_actor := auth.uid();
    v_is_service_role := (auth.role() = 'service_role');

    IF v_actor IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Unauthorized: Status changes require authenticated user';
    END IF;

    v_is_renter := (v_actor = NEW.renter_id);
    v_is_owner := (v_actor = NEW.owner_id);

    -- Service-role transitions
    IF v_is_service_role THEN
        IF OLD.status = 'REQUESTED' AND NEW.status = 'EXPIRED' THEN
            v_is_valid := true;
        ELSIF OLD.status = 'RENTAL_ACTIVE' AND NEW.status = 'OVERDUE' THEN
            v_is_valid := true;
        ELSE
            RAISE EXCEPTION 'Service role can only transition stale rentals to EXPIRED or OVERDUE';
        END IF;
    END IF;

    -- User transitions
    IF NOT v_is_valid AND v_actor IS NOT NULL THEN
        -- REQUESTED transitions
        IF OLD.status = 'REQUESTED' THEN
            IF NEW.status = 'ACCEPTED' AND v_is_owner THEN
                v_is_valid := true;
                PERFORM public.fn_auto_reject_overlaps(NEW.listing_id, NEW.id, NEW.start_date, NEW.end_date);
            ELSIF NEW.status = 'REJECTED' AND v_is_owner THEN
                v_is_valid := true;
            ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner) THEN
                v_is_valid := true;
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
            IF NEW.status = 'ITEM_PICKED_UP' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- ITEM_PICKED_UP transitions
        ELSIF OLD.status = 'ITEM_PICKED_UP' THEN
            IF NEW.status = 'RENTAL_ACTIVE' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- RENTAL_ACTIVE transitions
        ELSIF OLD.status = 'RENTAL_ACTIVE' THEN
            IF NEW.status = 'RETURN_REQUESTED' AND v_is_renter THEN v_is_valid := true;
            ELSIF NEW.status = 'RETURN_DELIVERY' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'DAMAGED_REVIEW' AND v_is_owner THEN v_is_valid := true;
            END IF;

        -- RETURN_REQUESTED transitions
        ELSIF OLD.status = 'RETURN_REQUESTED' THEN
            IF NEW.status = 'RETURN_DELIVERY' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'RETURNED' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'DAMAGED_REVIEW' AND v_is_owner THEN v_is_valid := true;
            END IF;

        -- RETURN_DELIVERY transitions
        ELSIF OLD.status = 'RETURN_DELIVERY' THEN
            IF NEW.status = 'RETURNED' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- RETURNED transitions
        ELSIF OLD.status = 'RETURNED' THEN
            IF NEW.status = 'COMPLETED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'DAMAGED_REVIEW' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- DAMAGED_REVIEW transitions
        ELSIF OLD.status = 'DAMAGED_REVIEW' THEN
            IF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'COMPLETED' AND v_is_owner THEN v_is_valid := true;
            END IF;

        -- DISPUTED transitions
        ELSIF OLD.status = 'DISPUTED' THEN
            IF NEW.status IN ('COMPLETED', 'CANCELLED') AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;
        END IF;
    END IF;

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Invalid status transition from % to % for user %', OLD.status, NEW.status, coalesce(v_actor::text, 'service_role');
    END IF;

    -- Event note & notification body
    v_event_note := coalesce(NEW.rejection_reason, 'Status changed to ' || NEW.status);
    v_notif_body := coalesce(NEW.rejection_reason, 'Your rental status changed to ' || replace(NEW.status, '_', ' ') || '.');

    -- Insert status event
    INSERT INTO public.rental_status_events (rental_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, v_actor, v_event_note);

    -- Notify opposing party
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
            v_notif_body,
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

-- ------------------------------------------------------------------------------
-- 7. OVERLAP TRIGGER (ACCEPTED-OR-LATER ONLY)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_check_rental_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status IN (
        'ACCEPTED', 'PAYMENT_PENDING', 'CONFIRMED', 'PICKUP_DELIVERY_PENDING',
        'ITEM_PICKED_UP', 'RENTAL_ACTIVE', 'RETURN_REQUESTED', 'RETURN_DELIVERY'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM public.rentals
            WHERE listing_id = NEW.listing_id
              AND id <> NEW.id
              AND status IN (
                  'ACCEPTED', 'PAYMENT_PENDING', 'CONFIRMED', 'PICKUP_DELIVERY_PENDING',
                  'ITEM_PICKED_UP', 'RENTAL_ACTIVE', 'RETURN_REQUESTED', 'RETURN_DELIVERY'
              )
              AND (start_date <= NEW.end_date AND end_date >= NEW.start_date)
        ) THEN
            RAISE EXCEPTION 'Listing already has an active or confirmed booking for these dates';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_rental_overlap ON public.rentals;
CREATE TRIGGER trg_check_rental_overlap
BEFORE INSERT OR UPDATE OF status, start_date, end_date ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.fn_check_rental_overlap();

-- ------------------------------------------------------------------------------
-- 8. EXPIRY FUNCTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_stale_rental_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer := 0;
BEGIN
    WITH expired_rows AS (
        UPDATE public.rentals
        SET status = 'EXPIRED',
            updated_at = now()
        WHERE status = 'REQUESTED'
          AND expires_at < now()
        RETURNING id
    )
    SELECT count(*) INTO v_count FROM expired_rows;

    RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_rental_requests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_rental_requests() TO service_role;

-- ------------------------------------------------------------------------------
-- 9. EVIDENCE TRIGGERS & IMMUTABILITY
-- ------------------------------------------------------------------------------

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
        RAISE EXCEPTION 'created_by must match the authenticated user (%)', auth.uid();
    END IF;

    SELECT renter_id, owner_id, status INTO v_rental
    FROM public.rentals WHERE id = NEW.rental_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rental does not exist';
    END IF;

    IF NEW.created_by <> v_rental.renter_id AND NEW.created_by <> v_rental.owner_id THEN
        RAISE EXCEPTION 'Only participants of the rental may upload evidence';
    END IF;

    IF v_rental.status NOT IN (
        'ITEM_PICKED_UP', 'RENTAL_ACTIVE', 'RETURN_REQUESTED',
        'RETURN_DELIVERY', 'RETURNED', 'DAMAGED_REVIEW'
    ) THEN
        RAISE EXCEPTION 'Evidence can only be uploaded during active, handover, or return statuses';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_rental_evidence_insert ON public.rental_evidence;
CREATE TRIGGER trg_validate_rental_evidence_insert
BEFORE INSERT ON public.rental_evidence
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_rental_evidence_insert();

CREATE OR REPLACE FUNCTION public.fn_prevent_rental_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'rental_evidence records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_rental_evidence_mutation ON public.rental_evidence;
CREATE TRIGGER trg_prevent_rental_evidence_mutation
BEFORE UPDATE OR DELETE ON public.rental_evidence
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_rental_evidence_mutation();

REVOKE UPDATE, DELETE ON public.rental_evidence FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 10. CONVERSATIONS TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_validate_conversation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_listing_owner uuid;
BEGIN
    IF NEW.renter_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'renter_id must match authenticated user';
    END IF;

    SELECT owner_id INTO v_listing_owner FROM public.listings WHERE id = NEW.listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing does not exist';
    END IF;

    IF NEW.owner_id IS DISTINCT FROM v_listing_owner THEN
        RAISE EXCEPTION 'owner_id must match the listing owner (%)', v_listing_owner;
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

-- ------------------------------------------------------------------------------
-- 11. MESSAGES TRIGGERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_validate_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conv record;
    v_recipient uuid;
    v_clean_body text;
BEGIN
    IF NEW.sender_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'sender_id must match authenticated user';
    END IF;

    SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation does not exist';
    END IF;

    IF auth.uid() <> v_conv.renter_id AND auth.uid() <> v_conv.owner_id THEN
        RAISE EXCEPTION 'Only conversation participants may send messages';
    END IF;

    v_recipient := CASE WHEN auth.uid() = v_conv.renter_id THEN v_conv.owner_id ELSE v_conv.renter_id END;

    -- Privacy blocks check
    IF EXISTS (
        SELECT 1 FROM public.blocks
        WHERE (blocker_id = v_recipient AND blocked_id = auth.uid())
           OR (blocker_id = auth.uid() AND blocked_id = v_recipient)
    ) THEN
        RAISE EXCEPTION 'Cannot message user due to privacy blocks';
    END IF;

    -- Update conversation updated_at
    UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;

    -- Insert notification for recipient (first 60 chars, no line breaks)
    v_clean_body := substring(regexp_replace(NEW.body, '[\r\n]+', ' ', 'g') from 1 for 60);

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
        v_recipient,
        'NEW_MESSAGE',
        'New Message',
        v_clean_body,
        '/messages/' || NEW.conversation_id::text
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_message_insert ON public.messages;
CREATE TRIGGER trg_validate_message_insert
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_message_insert();

CREATE OR REPLACE FUNCTION public.fn_lock_message_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.body IS DISTINCT FROM OLD.body OR
       NEW.sender_id IS DISTINCT FROM OLD.sender_id OR
       NEW.conversation_id IS DISTINCT FROM OLD.conversation_id OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Message content, sender, and metadata cannot be altered';
    END IF;

    IF OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN
        RAISE EXCEPTION 'read_at cannot be altered once set';
    END IF;

    IF OLD.read_at IS NULL AND NEW.read_at IS NULL THEN
        RAISE EXCEPTION 'read_at must transition from NULL to timestamp';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_message_columns ON public.messages;
CREATE TRIGGER trg_lock_message_columns
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.fn_lock_message_immutable_columns();

-- ------------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- blocks
DROP POLICY IF EXISTS "blocks_select_own" ON public.blocks;
CREATE POLICY "blocks_select_own" ON public.blocks FOR SELECT USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocks_insert_own" ON public.blocks;
CREATE POLICY "blocks_insert_own" ON public.blocks FOR INSERT WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocks_delete_own" ON public.blocks;
CREATE POLICY "blocks_delete_own" ON public.blocks FOR DELETE USING (blocker_id = auth.uid());

-- reports
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports FOR SELECT USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- rentals
DROP POLICY IF EXISTS "rentals_select_participants" ON public.rentals;
CREATE POLICY "rentals_select_participants" ON public.rentals
    FOR SELECT USING (renter_id = auth.uid() OR owner_id = auth.uid());

DROP POLICY IF EXISTS "rentals_insert_renter" ON public.rentals;
CREATE POLICY "rentals_insert_renter" ON public.rentals
    FOR INSERT WITH CHECK (renter_id = auth.uid());

DROP POLICY IF EXISTS "rentals_update_participants" ON public.rentals;
CREATE POLICY "rentals_update_participants" ON public.rentals
    FOR UPDATE USING (renter_id = auth.uid() OR owner_id = auth.uid());

-- rental_status_events (read-only for participants, no insert/update/delete policies)
DROP POLICY IF EXISTS "events_select_participants" ON public.rental_status_events;
CREATE POLICY "events_select_participants" ON public.rental_status_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.rentals r
            WHERE r.id = rental_id AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
        )
    );

-- rental_evidence (select and insert for participants only, no update/delete policies)
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
            WHERE r.id = rental_id
              AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
              AND r.status IN ('ITEM_PICKED_UP', 'RENTAL_ACTIVE', 'RETURN_REQUESTED', 'RETURN_DELIVERY', 'RETURNED', 'DAMAGED_REVIEW')
        )
    );

-- conversations
DROP POLICY IF EXISTS "conversations_select_participants" ON public.conversations;
CREATE POLICY "conversations_select_participants" ON public.conversations
    FOR SELECT USING (renter_id = auth.uid() OR owner_id = auth.uid());

DROP POLICY IF EXISTS "conversations_insert_renter" ON public.conversations;
CREATE POLICY "conversations_insert_renter" ON public.conversations
    FOR INSERT WITH CHECK (
        auth.uid() = renter_id AND
        owner_id = (SELECT owner_id FROM public.listings WHERE id = listing_id) AND
        renter_id <> owner_id
    );

-- messages
DROP POLICY IF EXISTS "messages_select_participants" ON public.messages;
CREATE POLICY "messages_select_participants" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND (c.renter_id = auth.uid() OR c.owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
CREATE POLICY "messages_insert_sender" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND (c.renter_id = auth.uid() OR c.owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "messages_update_recipient" ON public.messages;
CREATE POLICY "messages_update_recipient" ON public.messages
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

-- notifications (triggers only insert, user selects & updates own)
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 13. STORAGE BUCKET & POLICIES
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('rental-evidence', 'rental-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop any existing UPDATE, DELETE or ALL policies
DROP POLICY IF EXISTS "evidence_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "evidence_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "evidence_storage_all" ON storage.objects;
DROP POLICY IF EXISTS "rental_evidence_all" ON storage.objects;
DROP POLICY IF EXISTS "rental_evidence_storage_all" ON storage.objects;

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND cmd IN ('ALL', 'UPDATE', 'DELETE')
          AND (
            coalesce(qual, '') ILIKE '%rental-evidence%'
            OR coalesce(with_check, '') ILIKE '%rental-evidence%'
            OR policyname ILIKE '%rental%evidence%'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END;
$$;

DROP POLICY IF EXISTS "evidence_storage_read" ON storage.objects;
CREATE POLICY "evidence_storage_read" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'rental-evidence' AND
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.rentals r
            WHERE r.id::text = (storage.foldername(name))[1]
              AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "evidence_storage_insert" ON storage.objects;
CREATE POLICY "evidence_storage_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'rental-evidence' AND
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.rentals r
            WHERE r.id::text = (storage.foldername(name))[1]
              AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
        )
    );

-- ------------------------------------------------------------------------------
-- 14. REALTIME PUBLICATION
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END;
$$;
