-- Phase 5 Day 11: customer cancel while the job is still SEARCHING_PARTNER

-- 1. Cancel a print order (customer only, only before a partner accepts)
create or replace function public.cancel_my_print_job(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_job_id uuid;
  v_status text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.print_orders
    where id = p_order_id and customer_id = v_caller_id
  ) then
    raise exception 'Not your order';
  end if;

  select id, status into v_job_id, v_status
  from public.print_jobs
  where order_id = p_order_id;

  if v_job_id is null then
    raise exception 'No job found for this order';
  end if;

  if v_status <> 'SEARCHING_PARTNER' then
    raise exception 'This order can no longer be cancelled';
  end if;

  update public.print_jobs
  set status = 'CANCELLED', updated_at = now()
  where id = v_job_id and status = 'SEARCHING_PARTNER';

  if not found then
    raise exception 'This order can no longer be cancelled';
  end if;

  update public.print_job_offers
  set status = 'EXPIRED', updated_at = now()
  where job_id = v_job_id and status = 'OFFERED';
end;
$$;

revoke execute on function public.cancel_my_print_job(uuid) from public, anon;
grant execute on function public.cancel_my_print_job(uuid) to authenticated;

-- 2. Cancel a parcel order (customer only, only before a partner accepts)
create or replace function public.cancel_my_parcel_job(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_job_id uuid;
  v_status text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.parcel_orders
    where id = p_order_id and customer_id = v_caller_id
  ) then
    raise exception 'Not your order';
  end if;

  select id, status into v_job_id, v_status
  from public.parcel_jobs
  where order_id = p_order_id;

  if v_job_id is null then
    raise exception 'No job found for this order';
  end if;

  if v_status <> 'SEARCHING_PARTNER' then
    raise exception 'This order can no longer be cancelled';
  end if;

  update public.parcel_jobs
  set status = 'CANCELLED', updated_at = now()
  where id = v_job_id and status = 'SEARCHING_PARTNER';

  if not found then
    raise exception 'This order can no longer be cancelled';
  end if;

  update public.parcel_job_offers
  set status = 'EXPIRED', updated_at = now()
  where job_id = v_job_id and status = 'OFFERED';
end;
$$;

revoke execute on function public.cancel_my_parcel_job(uuid) from public, anon;
grant execute on function public.cancel_my_parcel_job(uuid) to authenticated;

notify pgrst, 'reload schema';
