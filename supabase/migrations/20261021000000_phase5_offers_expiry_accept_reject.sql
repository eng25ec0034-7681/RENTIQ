-- Phase 5 Day 8: accept, reject and expiry (5 minutes) for print and parcel offers

-- 1. Accept a print job
create or replace function public.accept_print_job(p_job_id uuid)
returns public.print_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_job public.print_jobs%rowtype;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.partner_profiles
    where user_id = v_caller_id and is_approved = true and is_online = true
  ) then
    raise exception 'Caller must be an approved, online partner';
  end if;

  if not exists (
    select 1 from public.print_job_offers
    where job_id = p_job_id and partner_id = v_caller_id and status = 'OFFERED'
      and created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Offer has expired or was not found';
  end if;

  update public.print_jobs
  set partner_id = v_caller_id, status = 'ACCEPTED', updated_at = now()
  where id = p_job_id and partner_id is null and status = 'SEARCHING_PARTNER'
  returning * into v_job;

  if not found then
    raise exception 'Print job is no longer available';
  end if;

  return v_job;
end;
$$;

revoke execute on function public.accept_print_job(uuid) from public, anon;
grant execute on function public.accept_print_job(uuid) to authenticated;

-- 2. Reject a print job (caller only)
create or replace function public.reject_print_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.print_job_offers
  set status = 'REJECTED', updated_at = now()
  where job_id = p_job_id and partner_id = v_caller_id;

  if not found then
    raise exception 'No offer found for this job and partner';
  end if;
end;
$$;

revoke execute on function public.reject_print_job(uuid) from public, anon;
grant execute on function public.reject_print_job(uuid) to authenticated;

-- 3. Accept a parcel job
create or replace function public.accept_parcel_job(p_job_id uuid)
returns public.parcel_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_job public.parcel_jobs%rowtype;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.partner_profiles
    where user_id = v_caller_id and is_approved = true and is_online = true
  ) then
    raise exception 'Caller must be an approved, online partner';
  end if;

  if not exists (
    select 1 from public.parcel_job_offers
    where job_id = p_job_id and partner_id = v_caller_id and status = 'OFFERED'
      and created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Offer has expired or was not found';
  end if;

  update public.parcel_jobs
  set partner_id = v_caller_id, status = 'ACCEPTED', updated_at = now()
  where id = p_job_id and partner_id is null and status = 'SEARCHING_PARTNER'
  returning * into v_job;

  if not found then
    raise exception 'Parcel job is no longer available';
  end if;

  return v_job;
end;
$$;

revoke execute on function public.accept_parcel_job(uuid) from public, anon;
grant execute on function public.accept_parcel_job(uuid) to authenticated;

-- 4. Reject a parcel job (caller only)
create or replace function public.reject_parcel_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.parcel_job_offers
  set status = 'REJECTED', updated_at = now()
  where job_id = p_job_id and partner_id = v_caller_id;

  if not found then
    raise exception 'No offer found for this job and partner';
  end if;
end;
$$;

revoke execute on function public.reject_parcel_job(uuid) from public, anon;
grant execute on function public.reject_parcel_job(uuid) to authenticated;

-- 5. List open offers: not expired, not rejected, job not yet taken
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
  where pjo.partner_id = auth.uid()
    and pjo.status = 'OFFERED'
    and pjo.created_at > now() - interval '5 minutes'
    and pj.partner_id is null
    and pj.status = 'SEARCHING_PARTNER'
  union all
  select 'Parcel'::text, pjo.job_id, po.pickup_zone, pjo.created_at
  from public.parcel_job_offers pjo
  join public.parcel_jobs pj on pj.id = pjo.job_id
  join public.parcel_orders po on po.id = pj.order_id
  where pjo.partner_id = auth.uid()
    and pjo.status = 'OFFERED'
    and pjo.created_at > now() - interval '5 minutes'
    and pj.partner_id is null
    and pj.status = 'SEARCHING_PARTNER'
  order by created_at desc;
$$;

revoke execute on function public.list_partner_offers() from public, anon;
grant execute on function public.list_partner_offers() to authenticated;

notify pgrst, 'reload schema';
