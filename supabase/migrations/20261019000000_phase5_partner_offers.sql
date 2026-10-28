-- Phase 5 Day 7: list the signed-in partner's open offers (print and parcel)
create or replace function public.list_partner_offers()
returns table (offer_type text, job_id uuid, pickup_zone text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select 'Print'::text, pjo.job_id, po.pickup_zone, pjo.created_at
  from public.print_job_offers pjo
  join public.print_jobs pj on pj.id = pjo.job_id
  join public.print_orders po on po.id = pj.order_id
  where pjo.partner_id = auth.uid() and pjo.status = 'OFFERED'
  union all
  select 'Parcel'::text, pjo.job_id, po.pickup_zone, pjo.created_at
  from public.parcel_job_offers pjo
  join public.parcel_jobs pj on pj.id = pjo.job_id
  join public.parcel_orders po on po.id = pj.order_id
  where pjo.partner_id = auth.uid() and pjo.status = 'OFFERED'
  order by created_at desc;
$$;

revoke execute on function public.list_partner_offers() from public, anon;
grant execute on function public.list_partner_offers() to authenticated;

notify pgrst, 'reload schema';
