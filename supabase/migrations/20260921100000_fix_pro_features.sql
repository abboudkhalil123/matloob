-- MATLOOB PRO feature activation/fix.
-- Apply this migration AFTER the existing 3 migration batches.
-- Implements the three promised PRO features:
-- 1) PRO suppliers can see all open requests.
-- 2) Active PRO suppliers receive matching-request notifications.
-- 3) Only active PRO suppliers can request account verification.

-- Keep FREE suppliers limited to requests that match one of their supplier categories.
-- PRO suppliers retain access to every open request.
create or replace function public.can_supplier_view_request(p_request_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_status text;
  v_is_pro boolean;
  v_free_enabled boolean;
  v_pro_enabled boolean;
  v_request_category uuid;
begin
  if v_user_id is null then return false; end if;

  select p.role into v_role from public.profiles p where p.id = v_user_id;
  if v_role <> 'supplier' then return false; end if;

  select r.status, r.category_id into v_status, v_request_category
  from public.requests r where r.id = p_request_id;
  if v_status is distinct from 'open' then return false; end if;

  select p.free_visibility_enabled, p.pro_visibility_enabled
  into v_free_enabled, v_pro_enabled
  from public.request_visibility_policy p where p.id = 1;

  v_is_pro := public.has_active_pro_subscription(v_user_id);

  if v_is_pro then
    return coalesce(v_pro_enabled, false);
  end if;

  if not coalesce(v_free_enabled, false) then return false; end if;
  if v_request_category is null then return false; end if;

  return exists (
    select 1 from public.supplier_categories sc
    where sc.supplier_id = v_user_id
      and sc.category_id = v_request_category
  );
end;
$$;

revoke all on function public.can_supplier_view_request(uuid) from public, anon;
grant execute on function public.can_supplier_view_request(uuid) to authenticated;

-- Matching notifications are a PRO-only benefit.
create or replace function public.can_supplier_view_request_for_matching(
  p_request_id uuid,
  p_supplier_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_role text;
  v_request_category uuid;
  v_pro_enabled boolean;
begin
  if p_request_id is null or p_supplier_id is null then return false; end if;

  select r.status, r.category_id into v_status, v_request_category
  from public.requests r where r.id = p_request_id;
  if v_status is distinct from 'open' then return false; end if;

  select p.role into v_role from public.profiles p where p.id = p_supplier_id;
  if v_role is distinct from 'supplier' then return false; end if;

  select p.pro_visibility_enabled into v_pro_enabled
  from public.request_visibility_policy p where p.id = 1;

  if not coalesce(v_pro_enabled, false) then return false; end if;
  if not public.is_active_pro_supplier_for_matching(p_supplier_id) then return false; end if;

  return exists (
    select 1
    from public.supplier_categories sc
    join public.supplier_profiles sp on sp.id = sc.supplier_id
    where sp.user_id = p_supplier_id
      and sc.category_id = v_request_category
  );
end;
$$;

revoke all on function public.can_supplier_view_request_for_matching(uuid, uuid) from public, anon, authenticated;

-- New open request -> notify only active PRO suppliers whose category matches.
create or replace function public.notify_matching_suppliers_for_new_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_city_name text;
  v_supplier_id uuid;
begin
  if new.status is distinct from 'open' or new.category_id is null then return new; end if;

  select c.name into v_city_name from public.cities c where c.id = new.city_id;

  for v_supplier_id in
    select distinct sp.user_id
    from public.supplier_categories sc
    join public.supplier_profiles sp on sp.id = sc.supplier_id
    join public.profiles pr on pr.id = sp.user_id and pr.role = 'supplier'
    where sc.category_id = new.category_id
      and sp.user_id <> new.requester_id
      and public.can_supplier_view_request_for_matching(new.id, sp.user_id)
  loop
    perform public.create_system_notification(
      v_supplier_id,
      'طلب جديد يطابق تخصصك',
      'طلب جديد: ' || new.title || case when v_city_name is not null then ' — المدينة: ' || v_city_name else '' end,
      'matching_request',
      new.id,
      null
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_matching_suppliers_for_new_request() from public, anon, authenticated;

drop trigger if exists requests_matching_notification on public.requests;
create trigger requests_matching_notification
after insert on public.requests
for each row execute function public.notify_matching_suppliers_for_new_request();

-- Verification is a PRO feature.
create or replace function public.create_verification_request()
returns public.verification_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.supplier_profiles;
  v_existing public.verification_requests;
  v_request public.verification_requests;
begin
  if v_user_id is null then raise exception 'يجب تسجيل الدخول أولًا.'; end if;

  if not exists (select 1 from public.profiles where id = v_user_id and role = 'supplier') then
    raise exception 'طلب التوثيق متاح للموردين فقط.';
  end if;

  if not public.has_active_pro_subscription(v_user_id) then
    raise exception 'طلب التوثيق متاح لمشتركي PRO فقط.';
  end if;

  select * into v_profile from public.supplier_profiles where user_id = v_user_id for update;
  if not found then raise exception 'يجب إنشاء ملف المورد أولًا.'; end if;
  if v_profile.verified then raise exception 'حسابك موثّق بالفعل.'; end if;

  select * into v_existing from public.verification_requests
  where supplier_id = v_user_id and status = 'pending' limit 1;
  if found then raise exception 'لديك طلب توثيق قيد المراجعة بالفعل.'; end if;

  insert into public.verification_requests (supplier_id, status)
  values (v_user_id, 'pending') returning * into v_request;
  return v_request;
end;
$$;

revoke all on function public.create_verification_request() from public, anon;
grant execute on function public.create_verification_request() to authenticated;

-- Fix: supplier_categories.supplier_id references supplier_profiles.id, so matching notifications must resolve sp.user_id.
