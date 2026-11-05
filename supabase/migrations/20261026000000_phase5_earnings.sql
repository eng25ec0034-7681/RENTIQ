CREATE OR REPLACE FUNCTION public.get_my_earnings(p_from date, p_to date)
RETURNS TABLE (
  day date,
  jobs int,
  partner_earnings int,
  platform_fee int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    c.completion_day AS day,
    COUNT(*)::int AS jobs,
    COALESCE(SUM(c.total_amount - c.platform_fee), 0)::int AS partner_earnings,
    COALESCE(SUM(c.platform_fee), 0)::int AS platform_fee
  FROM (
    SELECT
      (pj.updated_at AT TIME ZONE 'Asia/Kolkata')::date AS completion_day,
      po.total_amount,
      po.platform_fee
    FROM public.print_jobs pj
    JOIN public.print_orders po ON po.id = pj.order_id
    WHERE pj.partner_id = auth.uid()
      AND pj.status = 'COMPLETED'
      AND (pj.updated_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to

    UNION ALL

    SELECT
      (pj.updated_at AT TIME ZONE 'Asia/Kolkata')::date AS completion_day,
      po.total_amount,
      po.platform_fee
    FROM public.parcel_jobs pj
    JOIN public.parcel_orders po ON po.id = pj.order_id
    WHERE pj.partner_id = auth.uid()
      AND pj.status = 'COMPLETED'
      AND (pj.updated_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to
  ) c
  GROUP BY c.completion_day
  ORDER BY c.completion_day ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_platform_earnings(p_from date, p_to date)
RETURNS TABLE (
  day date,
  jobs int,
  partner_earnings int,
  platform_fee int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    c.completion_day AS day,
    COUNT(*)::int AS jobs,
    COALESCE(SUM(c.total_amount - c.platform_fee), 0)::int AS partner_earnings,
    COALESCE(SUM(c.platform_fee), 0)::int AS platform_fee
  FROM (
    SELECT
      (pj.updated_at AT TIME ZONE 'Asia/Kolkata')::date AS completion_day,
      po.total_amount,
      po.platform_fee
    FROM public.print_jobs pj
    JOIN public.print_orders po ON po.id = pj.order_id
    WHERE pj.status = 'COMPLETED'
      AND (pj.updated_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to

    UNION ALL

    SELECT
      (pj.updated_at AT TIME ZONE 'Asia/Kolkata')::date AS completion_day,
      po.total_amount,
      po.platform_fee
    FROM public.parcel_jobs pj
    JOIN public.parcel_orders po ON po.id = pj.order_id
    WHERE pj.status = 'COMPLETED'
      AND (pj.updated_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to
  ) c
  GROUP BY c.completion_day
  ORDER BY c.completion_day ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_earnings(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_earnings(date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_platform_earnings(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_earnings(date, date) TO authenticated;

notify pgrst, 'reload schema';
