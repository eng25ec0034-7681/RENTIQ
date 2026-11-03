CREATE OR REPLACE FUNCTION public.fn_notify_customer_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_id uuid;
    v_title text;
    v_body text;
    v_type text;
    v_is_print boolean;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status NOT IN (
        'ACCEPTED',
        'AT_SHOP',
        'PRINTING',
        'PICKED_UP',
        'IN_TRANSIT',
        'ARRIVED_AT_DROP',
        'DELIVERED',
        'COMPLETED',
        'CANCELLED',
        'NO_PARTNER_FOUND'
    ) THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'print_jobs' THEN
        v_is_print := true;
        SELECT customer_id INTO v_customer_id
        FROM public.print_orders
        WHERE id = NEW.order_id;
    ELSIF TG_TABLE_NAME = 'parcel_jobs' THEN
        v_is_print := false;
        SELECT customer_id INTO v_customer_id
        FROM public.parcel_orders
        WHERE id = NEW.order_id;
    ELSE
        RETURN NEW;
    END IF;

    IF v_customer_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF v_is_print THEN
        v_type := 'PRINT_JOB_' || NEW.status;
    ELSE
        v_type := 'PARCEL_JOB_' || NEW.status;
    END IF;

    IF NEW.status = 'ACCEPTED' THEN
        v_title := 'Partner Assigned';
        IF v_is_print THEN
            v_body := 'A partner has accepted your print order.';
        ELSE
            v_body := 'Your parcel now has a partner.';
        END IF;
    ELSIF NEW.status = 'AT_SHOP' THEN
        v_title := 'At Print Shop';
        IF v_is_print THEN v_body := 'Partner has arrived at the print shop.'; ELSE v_body := 'Partner has reached the pickup point.'; END IF;
    ELSIF NEW.status = 'PRINTING' THEN
        v_title := 'Printing Started';
        v_body := 'Your documents are currently being printed.';
    ELSIF NEW.status = 'PICKED_UP' THEN
        v_title := 'Picked Up';
        IF v_is_print THEN
            v_body := 'Your print order has been picked up.';
        ELSE
            v_body := 'Your parcel has been picked up.';
        END IF;
    ELSIF NEW.status = 'IN_TRANSIT' THEN
        v_title := 'In Transit';
        v_body := 'Your order is on the way.';
    ELSIF NEW.status = 'ARRIVED_AT_DROP' THEN
        v_title := 'Arrived at Drop Point';
        v_body := 'The partner has arrived at the drop point.';
    ELSIF NEW.status = 'DELIVERED' THEN
        v_title := 'Delivered';
        v_body := 'Your order has been delivered.';
    ELSIF NEW.status = 'COMPLETED' THEN
        v_title := 'Order Completed';
        v_body := 'Your service order is complete.';
    ELSIF NEW.status = 'CANCELLED' THEN
        v_title := 'Order Cancelled';
        v_body := 'Your order has been cancelled.';
    ELSIF NEW.status = 'NO_PARTNER_FOUND' THEN
        v_title := 'No Partner Found';
        v_body := 'No delivery partner was available for your order.';
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
        v_customer_id,
        v_type,
        v_title,
        v_body,
        '/service-orders'
    );

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_notify_customer_on_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_notify_customer_on_status() TO authenticated;

DROP TRIGGER IF EXISTS tr_notify_customer_on_status ON public.print_jobs;
DROP TRIGGER IF EXISTS tr_notify_customer_on_status_print ON public.print_jobs;
CREATE TRIGGER tr_notify_customer_on_status_print
    AFTER UPDATE OF status ON public.print_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_notify_customer_on_status();

DROP TRIGGER IF EXISTS tr_notify_customer_on_status ON public.parcel_jobs;
DROP TRIGGER IF EXISTS tr_notify_customer_on_status_parcel ON public.parcel_jobs;
CREATE TRIGGER tr_notify_customer_on_status_parcel
    AFTER UPDATE OF status ON public.parcel_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_notify_customer_on_status();

NOTIFY pgrst, 'reload schema';
