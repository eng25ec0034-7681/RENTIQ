-- ==============================================================================
-- PHASE 3 MANUAL VERIFICATION CHECKS SUITE
-- File: supabase/tests/phase3_checks.sql
--
-- Instructions: Run each test block in the Supabase SQL Editor.
-- Every test block is fully self-contained, creates its required fixture rows,
-- executes automated assertions via DO blocks, and concludes with ROLLBACK.
--
-- CONSTANTS / SUPABASE AUTH USER PLACEHOLDERS:
-- The three test users below must first exist in Supabase Authentication (auth.users)
-- and public.profiles prior to running these checks.
--
-- Replace the following placeholders with your project's real Supabase Auth user UUIDs:
--   c9943cd2-5d86-4b56-96c5-335eb082a25e   : Owner user UUID (e.g. owner@college.edu)
--   fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994  : Primary renter user UUID (e.g. renter1@college.edu)
--   e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e   : Third-party renter user UUID (e.g. third@college.edu)
--
-- Shared Listing ID: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001'
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- CHECK A: Renter inserts with status 'ACCEPTED' and total_amount 1.00.
-- Assert: Returned status is 'REQUESTED' and total_amount = days * listing.price_per_day.
-- Placeholders: c9943cd2-5d86-4b56-96c5-335eb082a25e, fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994
-- ------------------------------------------------------------------------------
BEGIN;

SELECT set_config('request.jwt.claims', '{"sub":"fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994","role":"authenticated"}', true);
SET LOCAL role authenticated;

DO $$
DECLARE
    v_rental_id uuid;
    v_status text;
    v_days int;
    v_price numeric;
    v_total numeric;
BEGIN
    INSERT INTO public.rentals (
        listing_id, renter_id, start_date, end_date, fulfillment, status, total_amount
    ) VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
        'fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994',
        CURRENT_DATE + 1,
        CURRENT_DATE + 3,
        'PICKUP',
        'ACCEPTED',
        1.00
    ) RETURNING id, status, days, price_per_day, total_amount
    INTO v_rental_id, v_status, v_days, v_price, v_total;

    IF v_status <> 'REQUESTED' THEN
        RAISE EXCEPTION 'CHECK A FAILED: status was not forced to REQUESTED (got %)', v_status;
    END IF;

    IF v_total <> (v_days * v_price) THEN
        RAISE EXCEPTION 'CHECK A FAILED: total_amount % did not equal days (%) * price_per_day (%)', v_total, v_days, v_price;
    END IF;

    RAISE NOTICE 'CHECK A PASSED: status forced to REQUESTED and total_amount computed from database snapshot';
END;
$$;
ROLLBACK;


-- ------------------------------------------------------------------------------
-- CHECK B: Renter sets payment_status = 'PAID'.
-- Assert: Expects error containing 'Unauthorized payment_status change'.
-- Placeholders: c9943cd2-5d86-4b56-96c5-335eb082a25e, fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994
-- ------------------------------------------------------------------------------
BEGIN;

INSERT INTO public.rentals (id, listing_id, renter_id, owner_id, start_date, end_date, days, price_per_day, rental_amount, total_amount, fulfillment, status, payment_status)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994', 'c9943cd2-5d86-4b56-96c5-335eb082a25e', CURRENT_DATE + 1, CURRENT_DATE + 3, 3, 25.00, 75.00, 75.00, 'PICKUP', 'ACCEPTED', 'PENDING')
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claims', '{"sub":"fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994","role":"authenticated"}', true);
SET LOCAL role authenticated;

DO $$
BEGIN
    UPDATE public.rentals
    SET payment_status = 'PAID'
    WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001';

    RAISE EXCEPTION 'CHECK B FAILED: renter was able to update payment_status to PAID';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Unauthorized payment_status change%' THEN
        RAISE;
    END IF;
    RAISE NOTICE 'CHECK B PASSED: renter correctly blocked from setting payment_status = PAID';
END;
$$;
ROLLBACK;


-- ------------------------------------------------------------------------------
-- CHECK C: Owner sets payment_status = 'PAID' on a rental with status 'ACCEPTED'.
-- Assert: Exactly 1 row updated.
-- Placeholders: c9943cd2-5d86-4b56-96c5-335eb082a25e, fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994
-- ------------------------------------------------------------------------------
BEGIN;

INSERT INTO public.rentals (id, listing_id, renter_id, owner_id, start_date, end_date, days, price_per_day, rental_amount, total_amount, fulfillment, status, payment_status)
VALUES ('cccccccc-cccc-cccc-cccc-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994', 'c9943cd2-5d86-4b56-96c5-335eb082a25e', CURRENT_DATE + 1, CURRENT_DATE + 3, 3, 25.00, 75.00, 75.00, 'PICKUP', 'ACCEPTED', 'PENDING')
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claims', '{"sub":"c9943cd2-5d86-4b56-96c5-335eb082a25e","role":"authenticated"}', true);
SET LOCAL role authenticated;

DO $$
DECLARE
    v_rows integer;
BEGIN
    UPDATE public.rentals
    SET payment_status = 'PAID'
    WHERE id = 'cccccccc-cccc-cccc-cccc-000000000001'
      AND status = 'ACCEPTED';

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'CHECK C FAILED: expected 1 row updated, got %', v_rows;
    END IF;
    RAISE NOTICE 'CHECK C PASSED: owner successfully set payment_status = PAID on ACCEPTED rental';
END;
$$;
ROLLBACK;


-- ------------------------------------------------------------------------------
-- CHECK D: Two overlapping REQUESTED rentals for one listing both exist.
-- Assert: count = 2.
-- Placeholders: c9943cd2-5d86-4b56-96c5-335eb082a25e, fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994, e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e
-- ------------------------------------------------------------------------------
BEGIN;

-- Renter 1 creates request
SELECT set_config('request.jwt.claims', '{"sub":"fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994","role":"authenticated"}', true);
SET LOCAL role authenticated;
INSERT INTO public.rentals (id, listing_id, renter_id, start_date, end_date, fulfillment)
VALUES ('dddddddd-dddd-dddd-dddd-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994', CURRENT_DATE + 5, CURRENT_DATE + 10, 'PICKUP');

-- Renter 2 creates overlapping request
SELECT set_config('request.jwt.claims', '{"sub":"e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e","role":"authenticated"}', true);
SET LOCAL role authenticated;
INSERT INTO public.rentals (id, listing_id, renter_id, start_date, end_date, fulfillment)
VALUES ('dddddddd-dddd-dddd-dddd-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e', CURRENT_DATE + 7, CURRENT_DATE + 12, 'PICKUP');

-- Owner verifies count = 2
SELECT set_config('request.jwt.claims', '{"sub":"c9943cd2-5d86-4b56-96c5-335eb082a25e","role":"authenticated"}', true);
SET LOCAL role authenticated;

DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.rentals
    WHERE listing_id = 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001'
      AND status = 'REQUESTED';

    IF v_count <> 2 THEN
        RAISE EXCEPTION 'CHECK D FAILED: expected 2 overlapping REQUESTED rentals, got %', v_count;
    END IF;
    RAISE NOTICE 'CHECK D PASSED: two overlapping REQUESTED rentals co-exist successfully';
END;
$$;
ROLLBACK;


-- ------------------------------------------------------------------------------
-- CHECK E: Owner accepts rental 1.
-- Assert: Rental 2 has status 'REJECTED', rejection_reason = 'Item no longer available for these dates',
-- exactly 1 rental_status_events row with to_status 'REJECTED' for rental 2,
-- and exactly 1 notification with link '/orders/<rental2>'.
-- Placeholders: c9943cd2-5d86-4b56-96c5-335eb082a25e, fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994, e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e
-- ------------------------------------------------------------------------------
BEGIN;

-- Renter 1 creates rental 1
SELECT set_config('request.jwt.claims', '{"sub":"fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994","role":"authenticated"}', true);
SET LOCAL role authenticated;
INSERT INTO public.rentals (id, listing_id, renter_id, start_date, end_date, fulfillment)
VALUES ('eeeeeeee-eeee-eeee-eeee-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994', CURRENT_DATE + 5, CURRENT_DATE + 10, 'PICKUP');

-- Renter 2 creates overlapping rental 2
SELECT set_config('request.jwt.claims', '{"sub":"e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e","role":"authenticated"}', true);
SET LOCAL role authenticated;
INSERT INTO public.rentals (id, listing_id, renter_id, start_date, end_date, fulfillment)
VALUES ('eeeeeeee-eeee-eeee-eeee-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e', CURRENT_DATE + 7, CURRENT_DATE + 12, 'PICKUP');

-- Owner accepts rental 1 as authenticated user
SELECT set_config('request.jwt.claims', '{"sub":"c9943cd2-5d86-4b56-96c5-335eb082a25e","role":"authenticated"}', true);
SET LOCAL role authenticated;

UPDATE public.rentals
SET status = 'ACCEPTED'
WHERE id = 'eeeeeeee-eeee-eeee-eeee-000000000001';

-- Run notification and status-event SELECTs without SET LOCAL role authenticated
-- (running as the SQL Editor role so cross-user notifications and events can be verified without RLS restrictions)
RESET ROLE;

DO $$
DECLARE
    v_r2_status text;
    v_r2_reason text;
    v_events_count integer;
    v_notif_count integer;
BEGIN
    SELECT status, rejection_reason INTO v_r2_status, v_r2_reason
    FROM public.rentals WHERE id = 'eeeeeeee-eeee-eeee-eeee-000000000002';

    IF v_r2_status <> 'REJECTED' THEN
        RAISE EXCEPTION 'CHECK E FAILED: rental 2 status was not REJECTED (got %)', v_r2_status;
    END IF;

    IF v_r2_reason <> 'Item no longer available for these dates' THEN
        RAISE EXCEPTION 'CHECK E FAILED: rental 2 rejection_reason unexpected (got %)', v_r2_reason;
    END IF;

    -- Verified as SQL Editor role: status-event audit row
    SELECT count(*) INTO v_events_count
    FROM public.rental_status_events
    WHERE rental_id = 'eeeeeeee-eeee-eeee-eeee-000000000002'
      AND to_status = 'REJECTED';

    IF v_events_count <> 1 THEN
        RAISE EXCEPTION 'CHECK E FAILED: expected 1 REJECTED event for rental 2, got %', v_events_count;
    END IF;

    -- Verified as SQL Editor role: recipient's notification row
    SELECT count(*) INTO v_notif_count
    FROM public.notifications
    WHERE user_id = 'e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e'
      AND link = '/orders/eeeeeeee-eeee-eeee-eeee-000000000002';

    IF v_notif_count <> 1 THEN
        RAISE EXCEPTION 'CHECK E FAILED: expected 1 notification for rental 2, got %', v_notif_count;
    END IF;

    RAISE NOTICE 'CHECK E PASSED: overlapping rental auto-rejected with reason, exactly 1 audit event, and 1 notification';
END;
$$;
ROLLBACK;


-- ------------------------------------------------------------------------------
-- CHECK F: Renter sets REQUESTED to ACCEPTED.
-- Assert: Expects error containing 'Invalid status transition'.
-- Placeholders: c9943cd2-5d86-4b56-96c5-335eb082a25e, fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994
-- ------------------------------------------------------------------------------
BEGIN;

INSERT INTO public.rentals (id, listing_id, renter_id, owner_id, start_date, end_date, days, price_per_day, rental_amount, total_amount, fulfillment, status)
VALUES ('ffffffff-ffff-ffff-ffff-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994', 'c9943cd2-5d86-4b56-96c5-335eb082a25e', CURRENT_DATE + 1, CURRENT_DATE + 3, 3, 25.00, 75.00, 75.00, 'PICKUP', 'REQUESTED')
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claims', '{"sub":"fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994","role":"authenticated"}', true);
SET LOCAL role authenticated;

DO $$
BEGIN
    UPDATE public.rentals
    SET status = 'ACCEPTED'
    WHERE id = 'ffffffff-ffff-ffff-ffff-000000000001';

    RAISE EXCEPTION 'CHECK F FAILED: renter was able to transition rental to ACCEPTED';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Invalid status transition%' THEN
        RAISE;
    END IF;
    RAISE NOTICE 'CHECK F PASSED: renter correctly blocked from setting status = ACCEPTED';
END;
$$;
ROLLBACK;


-- ------------------------------------------------------------------------------
-- CHECK G: Renter UPDATE and DELETE on rental_evidence.
-- Assert: Each expects error containing 'immutable'.
-- Placeholders: c9943cd2-5d86-4b56-96c5-335eb082a25e, fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994
-- ------------------------------------------------------------------------------
BEGIN;

INSERT INTO public.rentals (id, listing_id, renter_id, owner_id, start_date, end_date, days, price_per_day, rental_amount, total_amount, fulfillment, status)
VALUES ('gggggggg-gggg-gggg-gggg-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994', 'c9943cd2-5d86-4b56-96c5-335eb082a25e', CURRENT_DATE + 1, CURRENT_DATE + 3, 3, 25.00, 75.00, 75.00, 'PICKUP', 'RENTAL_ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Set session context to authenticated renter
SELECT set_config('request.jwt.claims', '{"sub":"fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994","role":"authenticated"}', true);
SET LOCAL role authenticated;

-- Insert evidence row as renter so created_by = auth.uid()
INSERT INTO public.rental_evidence (id, rental_id, type, condition_notes, created_by)
VALUES ('gggggggg-eeee-eeee-eeee-000000000001', 'gggggggg-gggg-gggg-gggg-000000000001', 'HANDOVER', 'Initial notes', 'fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994');

-- Test UPDATE immutability
DO $$
BEGIN
    UPDATE public.rental_evidence
    SET condition_notes = 'Tampered notes'
    WHERE id = 'gggggggg-eeee-eeee-eeee-000000000001';

    RAISE EXCEPTION 'CHECK G (UPDATE) FAILED: update on rental_evidence was permitted';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%immutable%' THEN
        RAISE;
    END IF;
    RAISE NOTICE 'CHECK G (UPDATE) PASSED: update rejected on immutable rental_evidence';
END;
$$;

-- Test DELETE immutability
DO $$
BEGIN
    DELETE FROM public.rental_evidence
    WHERE id = 'gggggggg-eeee-eeee-eeee-000000000001';

    RAISE EXCEPTION 'CHECK G (DELETE) FAILED: delete on rental_evidence was permitted';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%immutable%' THEN
        RAISE;
    END IF;
    RAISE NOTICE 'CHECK G (DELETE) PASSED: delete rejected on immutable rental_evidence';
END;
$$;
ROLLBACK;


-- ------------------------------------------------------------------------------
-- CHECK H: Third user SELECT on the rental returns 0 rows.
-- Assert: count = 0.
-- Placeholders: c9943cd2-5d86-4b56-96c5-335eb082a25e, fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994, e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e
-- ------------------------------------------------------------------------------
BEGIN;

INSERT INTO public.rentals (id, listing_id, renter_id, owner_id, start_date, end_date, days, price_per_day, rental_amount, total_amount, fulfillment, status)
VALUES ('hhhhhhhh-hhhh-hhhh-hhhh-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994', 'c9943cd2-5d86-4b56-96c5-335eb082a25e', CURRENT_DATE + 1, CURRENT_DATE + 3, 3, 25.00, 75.00, 75.00, 'PICKUP', 'REQUESTED')
ON CONFLICT (id) DO NOTHING;

-- Third party selects rental
SELECT set_config('request.jwt.claims', '{"sub":"e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e","role":"authenticated"}', true);
SET LOCAL role authenticated;

DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.rentals
    WHERE id = 'hhhhhhhh-hhhh-hhhh-hhhh-000000000001';

    IF v_count <> 0 THEN
        RAISE EXCEPTION 'CHECK H FAILED: third party could see rental (count = %)', v_count;
    END IF;
    RAISE NOTICE 'CHECK H PASSED: third party query returned 0 rows as enforced by RLS';
END;
$$;
ROLLBACK;


-- ------------------------------------------------------------------------------
-- CHECK I: Third user calls fn_auto_reject_overlaps.
-- Assert: Expects error containing 'permission denied'.
-- Placeholders: e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e
-- ------------------------------------------------------------------------------
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"e3d0d265-f1f9-4bce-bb54-0e1a72c36d2e","role":"authenticated"}', true);
SET LOCAL role authenticated;

DO $$
BEGIN
    PERFORM public.fn_auto_reject_overlaps(
        'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
        'eeeeeeee-eeee-eeee-eeee-000000000001',
        CURRENT_DATE,
        CURRENT_DATE + 5
    );

    RAISE EXCEPTION 'CHECK I FAILED: third party was able to execute fn_auto_reject_overlaps';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN
        RAISE;
    END IF;
    RAISE NOTICE 'CHECK I PASSED: direct execution of fn_auto_reject_overlaps correctly blocked with permission denied';
END;
$$;
ROLLBACK;


-- ------------------------------------------------------------------------------
-- CHECK J: Renter sets total_amount = 0.
-- Assert: Expects error containing 'locked'.
-- Placeholders: c9943cd2-5d86-4b56-96c5-335eb082a25e, fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994
-- ------------------------------------------------------------------------------
BEGIN;

INSERT INTO public.rentals (id, listing_id, renter_id, owner_id, start_date, end_date, days, price_per_day, rental_amount, total_amount, fulfillment, status)
VALUES ('jjjjjjjj-jjjj-jjjj-jjjj-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994', 'c9943cd2-5d86-4b56-96c5-335eb082a25e', CURRENT_DATE + 1, CURRENT_DATE + 3, 3, 25.00, 75.00, 75.00, 'PICKUP', 'REQUESTED')
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claims', '{"sub":"fa74e4c8-5a4a-4d93-a81e-2fb6df3b8994","role":"authenticated"}', true);
SET LOCAL role authenticated;

DO $$
BEGIN
    UPDATE public.rentals
    SET total_amount = 0.00
    WHERE id = 'jjjjjjjj-jjjj-jjjj-jjjj-000000000001';

    RAISE EXCEPTION 'CHECK J FAILED: renter was able to update locked column total_amount';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%locked%' THEN
        RAISE;
    END IF;
    RAISE NOTICE 'CHECK J PASSED: update on locked column total_amount correctly rejected';
END;
$$;
ROLLBACK;
