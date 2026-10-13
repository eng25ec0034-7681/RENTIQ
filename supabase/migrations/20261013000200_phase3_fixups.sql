-- ==============================================================================
-- PHASE 3 FIXUPS MIGRATION
-- File: supabase/migrations/20261013000200_phase3_fixups.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RENTAL EVIDENCE IMMUTABILITY
-- Rental evidence is IMMUTABLE: no UPDATE and no DELETE policies or grants
-- on rental_evidence or on storage objects in the rental-evidence bucket.
-- Drop any FOR ALL, UPDATE, or DELETE policies on storage.objects for rental-evidence.
-- ------------------------------------------------------------------------------

-- Revoke UPDATE and DELETE privileges on public.rental_evidence
REVOKE UPDATE, DELETE ON public.rental_evidence FROM PUBLIC, authenticated, anon;

-- Drop any existing UPDATE or DELETE policies on rental_evidence
DROP POLICY IF EXISTS "evidence_update_participants" ON public.rental_evidence;
DROP POLICY IF EXISTS "evidence_delete_participants" ON public.rental_evidence;

-- Trigger to strictly block any UPDATE or DELETE on rental_evidence
CREATE OR REPLACE FUNCTION public.fn_prevent_rental_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'rental_evidence records are immutable and cannot be updated or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_rental_evidence_mutation ON public.rental_evidence;
CREATE TRIGGER trg_prevent_rental_evidence_mutation
BEFORE UPDATE OR DELETE ON public.rental_evidence
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_rental_evidence_mutation();

-- Ensure storage objects in rental-evidence bucket cannot be updated or deleted
DROP POLICY IF EXISTS "evidence_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "evidence_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "evidence_storage_all" ON storage.objects;
DROP POLICY IF EXISTS "rental_evidence_all" ON storage.objects;
DROP POLICY IF EXISTS "rental_evidence_storage_all" ON storage.objects;

-- Confirm no FOR ALL policies exist on storage.objects for rental-evidence, and drop any found
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND cmd = 'ALL'
          AND (
            coalesce(qual, '') ILIKE '%rental-evidence%'
            OR coalesce(with_check, '') ILIKE '%rental-evidence%'
            OR policyname ILIKE '%rental-evidence%'
            OR policyname ILIKE '%rental_evidence%'
            OR policyname ILIKE '%evidence%'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. CONVERSATIONS: STRICT OWNER_ID CHECK & SELF-CHAT PREVENTION
-- Keep RLS WITH CHECK as single enforcement; reject mismatched owner_id with
-- error instead of silent overwrite; keep self-chat check.
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
    -- Renter must equal auth.uid()
    IF NEW.renter_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the authenticated renter may initiate a conversation';
    END IF;

    -- Fetch listing owner
    SELECT owner_id INTO v_listing_owner FROM public.listings WHERE id = NEW.listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing does not exist';
    END IF;

    -- Reject mismatched owner_id with a clear error (no silent overwrite)
    IF NEW.owner_id IS DISTINCT FROM v_listing_owner THEN
        RAISE EXCEPTION 'owner_id must match the listing owner (%)', v_listing_owner;
    END IF;

    -- Prevent self-chat
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

DROP POLICY IF EXISTS "conversations_insert_renter" ON public.conversations;
CREATE POLICY "conversations_insert_renter" ON public.conversations
    FOR INSERT WITH CHECK (
        auth.uid() = renter_id AND
        owner_id = (SELECT owner_id FROM public.listings WHERE id = listing_id) AND
        renter_id <> owner_id
    );

-- ------------------------------------------------------------------------------
-- 3. MESSAGES: STRICT READ RECEIPTS (read_at ONLY FROM NULL TO TIMESTAMP)
-- Only read_at may change; read_at may only go from NULL to a timestamp
-- (never back to NULL, never altered once set).
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_lock_message_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Block any changes to body, sender_id, conversation_id, created_at
    IF NEW.body IS DISTINCT FROM OLD.body OR
       NEW.sender_id IS DISTINCT FROM OLD.sender_id OR
       NEW.conversation_id IS DISTINCT FROM OLD.conversation_id OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Message content, sender, and metadata cannot be altered';
    END IF;

    -- read_at may never be changed once set
    IF OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN
        RAISE EXCEPTION 'read_at cannot be altered once set';
    END IF;

    -- read_at must transition from NULL to a non-NULL timestamp
    IF OLD.read_at IS NULL AND NEW.read_at IS NULL THEN
        RAISE EXCEPTION 'Only read_at transitions from NULL to a timestamp are permitted';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_message_columns ON public.messages;
CREATE TRIGGER trg_lock_message_columns
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.fn_lock_message_immutable_columns();

-- RLS: Only the other participant can update read_at
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

-- ------------------------------------------------------------------------------
-- 4. RENTALS: IMMUTABLE COLUMNS & PAYMENT STATUS ENFORCEMENT
-- - Lock identity, pricing, and dates
-- - Allow renter to update payment_method
-- - PAYMENT STATUS CHANGES: allow only PENDING->PAID by owner (or service_role).
--   Reject any other payment_status change except by service_role.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_lock_rental_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Lock identity, pricing, and rental dates
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

    -- Restrict UPDATE to status, payment_status, payment_method, and updated_at
    IF NEW.fulfillment IS DISTINCT FROM OLD.fulfillment OR
       NEW.message IS DISTINCT FROM OLD.message OR
       NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Only status, payment_status, and payment_method may be updated on rentals';
    END IF;

    -- Renter or Owner may update payment_method
    IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
        IF auth.uid() <> OLD.renter_id AND auth.uid() <> OLD.owner_id AND auth.role() <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthorized to update payment method';
        END IF;
    END IF;

    -- Payment status changes: allow only PENDING->PAID by the owner (or service_role).
    -- Reject any other payment_status change except by service_role.
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
        IF auth.role() = 'service_role' THEN
            -- Service role is allowed any payment_status change
            NULL;
        ELSIF auth.uid() = OLD.owner_id AND OLD.payment_status = 'PENDING' AND NEW.payment_status = 'PAID' THEN
            -- Only owner may confirm payment from PENDING to PAID
            NULL;
        ELSE
            RAISE EXCEPTION 'Unauthorized payment_status change: only owner may transition PENDING to PAID';
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
-- 5. TRANSITIONS: SERVICE-ROLE CHECK, NO USER EXPIRED, AUTO-REJECT OVERLAPS
-- - auth.role() = 'service_role' replaces current_setting
-- - Remove user-path EXPIRED transition (service role only)
-- - Session flag 'app.auto_reject': bypasses transition logic on nested auto-reject updates
-- - When owner accepts (REQUESTED to ACCEPTED), automatically reject every other
--   overlapping REQUESTED rental: update status to REJECTED, insert audit event,
--   and insert notification for the affected renter.
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
    v_other record;
BEGIN
    NEW.updated_at := now();

    -- Bypass transition logic when nested auto-reject session flag is active
    IF current_setting('app.auto_reject', true) = 'on' THEN
        RETURN NEW;
    END IF;

    -- On initial creation:
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

    -- Never allow v_actor IS NULL except for service_role
    IF v_actor IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Unauthorized: Status changes require authenticated user';
    END IF;

    v_is_renter := (v_actor = NEW.renter_id);
    v_is_owner := (v_actor = NEW.owner_id);

    -- Service-role automated transitions (expiry and overdue only)
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
            IF NEW.status = 'ACCEPTED' AND v_is_owner THEN
                v_is_valid := true;

                -- Set session flag so nested updates bypass transition logic without recursive triggers
                PERFORM set_config('app.auto_reject', 'on', true);

                -- Auto-reject every other overlapping REQUESTED rental for the same listing
                FOR v_other IN
                    SELECT id, renter_id FROM public.rentals
                    WHERE listing_id = NEW.listing_id
                      AND id <> NEW.id
                      AND status = 'REQUESTED'
                      AND (start_date <= NEW.end_date AND end_date >= NEW.start_date)
                LOOP
                    -- 1. Set status to REJECTED
                    UPDATE public.rentals
                    SET status = 'REJECTED',
                        updated_at = now()
                    WHERE id = v_other.id;

                    -- 2. Insert rental_status_events row with exact audit note
                    INSERT INTO public.rental_status_events (rental_id, from_status, to_status, changed_by, note)
                    VALUES (v_other.id, 'REQUESTED', 'REJECTED', v_actor, 'Item no longer available for these dates');

                    -- 3. Insert notification for the affected renter
                    INSERT INTO public.notifications (user_id, type, title, body, link)
                    VALUES (
                        v_other.renter_id,
                        'RENTAL_STATUS_REJECTED',
                        'Rental Request Declined',
                        'Item no longer available for these dates.',
                        '/orders/' || v_other.id::text
                    );
                END LOOP;

                -- Reset session flag after loop completes
                PERFORM set_config('app.auto_reject', 'off', true);

            ELSIF NEW.status = 'REJECTED' AND v_is_owner THEN
                v_is_valid := true;
            ELSIF NEW.status = 'CANCELLED' AND (v_is_renter OR v_is_owner) THEN
                v_is_valid := true;
            -- User path EXPIRED is removed; only service_role can expire
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
            -- Renter only can request return
            IF NEW.status = 'RETURN_REQUESTED' AND v_is_renter THEN v_is_valid := true;
            ELSIF NEW.status = 'RETURN_DELIVERY' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            ELSIF NEW.status = 'OVERDUE' AND (v_is_owner AND now() > NEW.end_date) THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            -- Owner only flags damage review
            ELSIF NEW.status = 'DAMAGED_REVIEW' AND v_is_owner THEN v_is_valid := true;
            END IF;

        -- RETURN_REQUESTED transitions
        ELSIF OLD.status = 'RETURN_REQUESTED' THEN
            IF NEW.status = 'RETURN_DELIVERY' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            -- Owner only confirms returned
            ELSIF NEW.status = 'RETURNED' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            -- Owner only flags damage review
            ELSIF NEW.status = 'DAMAGED_REVIEW' AND v_is_owner THEN v_is_valid := true;
            END IF;

        -- RETURN_DELIVERY transitions
        ELSIF OLD.status = 'RETURN_DELIVERY' THEN
            -- Owner only confirms returned
            IF NEW.status = 'RETURNED' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- RETURNED transitions
        ELSIF OLD.status = 'RETURNED' THEN
            IF NEW.status = 'COMPLETED' AND (v_is_owner OR v_is_renter) THEN v_is_valid := true;
            -- Owner only flags damage review
            ELSIF NEW.status = 'DAMAGED_REVIEW' AND v_is_owner THEN v_is_valid := true;
            ELSIF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            END IF;

        -- DAMAGED_REVIEW transitions
        ELSIF OLD.status = 'DAMAGED_REVIEW' THEN
            IF NEW.status = 'DISPUTED' AND (v_is_renter OR v_is_owner) THEN v_is_valid := true;
            -- Owner only marks completed after damage review
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

    -- Log status event
    INSERT INTO public.rental_status_events (rental_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, v_actor, 'Status changed to ' || NEW.status);

    -- Notify opposing party with safe fixed text
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

-- ==============================================================================
-- 6. VERIFICATION & TESTING SCRIPTS
-- Execute the SQL blocks below to verify all security and business constraints.
-- ==============================================================================

/*
--------------------------------------------------------------------------------
TEST 1: RENTER CANNOT SET PAYMENT_STATUS TO PAID
--------------------------------------------------------------------------------
-- Simulate authenticated renter trying to update payment_status to 'PAID'
BEGIN;
-- Set role and auth uid to renter
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

UPDATE public.rentals
SET payment_status = 'PAID'
WHERE id = '<rental_id_where_renter_is_11111111-1111-1111-1111-111111111111>';

-- EXPECTED RESULT:
-- ERROR: Unauthorized payment_status change: only owner may transition PENDING to PAID
ROLLBACK;


--------------------------------------------------------------------------------
TEST 2: OWNER ACCEPTING ONE REQUEST REJECTS AN OVERLAPPING ONE
--------------------------------------------------------------------------------
-- Given two rental requests (R1 and R2) for the same listing with overlapping dates,
-- both initially in 'REQUESTED' status:
BEGIN;
-- Set role and auth uid to listing owner
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

-- Owner accepts R1
UPDATE public.rentals
SET status = 'ACCEPTED'
WHERE id = '<r1_id>';

-- Verification Query 1: R1 is accepted
SELECT id, status FROM public.rentals WHERE id = '<r1_id>';
-- Expected: status = 'ACCEPTED'

-- Verification Query 2: Overlapping R2 was automatically rejected
SELECT id, status FROM public.rentals WHERE id = '<r2_id>';
-- Expected: status = 'REJECTED'

-- Verification Query 3: Audit event inserted for R2
SELECT rental_id, from_status, to_status, changed_by, note
FROM public.rental_status_events
WHERE rental_id = '<r2_id>'
ORDER BY created_at DESC LIMIT 1;
-- Expected: from_status = 'REQUESTED', to_status = 'REJECTED', note = 'Item no longer available for these dates'

-- Verification Query 4: Notification inserted for R2 renter
SELECT user_id, type, title, body, link
FROM public.notifications
WHERE link = '/orders/<r2_id>'
ORDER BY created_at DESC LIMIT 1;
-- Expected: type = 'RENTAL_STATUS_REJECTED', body = 'Item no longer available for these dates.'

ROLLBACK;


--------------------------------------------------------------------------------
TEST 3: RENTER CANNOT UPDATE OR DELETE RENTAL_EVIDENCE
--------------------------------------------------------------------------------
BEGIN;
-- Set role and auth uid to renter
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Attempt UPDATE on rental_evidence
UPDATE public.rental_evidence
SET condition_notes = 'Tampered evidence notes'
WHERE rental_id = '<rental_id>';
-- EXPECTED RESULT:
-- ERROR: rental_evidence records are immutable and cannot be updated or deleted

-- Attempt DELETE on rental_evidence
DELETE FROM public.rental_evidence
WHERE rental_id = '<rental_id>';
-- EXPECTED RESULT:
-- ERROR: rental_evidence records are immutable and cannot be updated or deleted

ROLLBACK;


--------------------------------------------------------------------------------
TEST 4: NON-PARTICIPANT CANNOT READ A RENTAL
--------------------------------------------------------------------------------
BEGIN;
-- Authenticate as a student who is neither the renter nor the owner
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';

SELECT id, listing_id, renter_id, owner_id, status
FROM public.rentals
WHERE id = '<rental_id>';
-- EXPECTED RESULT:
-- 0 rows returned (RLS policy rentals_select_participants restricts visibility)

ROLLBACK;


--------------------------------------------------------------------------------
TEST 5: QUERY LISTING ALL STORAGE.OBJECTS POLICIES
--------------------------------------------------------------------------------
-- Inspect all active storage.objects policies to ensure no FOR ALL policies exist on rental-evidence
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- EXPECTED RESULT:
-- - evidence_storage_read has cmd = 'SELECT'
-- - evidence_storage_insert has cmd = 'INSERT'
-- - NO policies on rental-evidence bucket have cmd = 'ALL', 'UPDATE', or 'DELETE'
*/

-- ==============================================================================
-- END OF PHASE 3 FIXUPS MIGRATION
-- ==============================================================================
