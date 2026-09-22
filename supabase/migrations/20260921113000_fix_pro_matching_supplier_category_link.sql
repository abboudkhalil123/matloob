-- MATLOOB: final PRO matching-notification fix.
-- supplier_categories.supplier_id -> supplier_profiles.id, while auth/profile identity is supplier_profiles.user_id.

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

  select r.status, r.category_id
    into v_status, v_request_category
  from public.requests r
  where r.id = p_request_id;

  if v_status is distinct from 'open' or v_request_category is null then return false; end if;

  select p.role into v_role
  from public.profiles p
  where p.id = p_supplier_id;

  if v_role is distinct from 'supplier' then return false; end if;

  select p.pro_visibility_enabled into v_pro_enabled
  from public.request_visibility_policy p
  where p.id = 1;

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

create or replace function public.notify_matching_suppliers_for_new_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_city_name text;
  v_supplier_user_id uuid;
begin
  if new.status is distinct from 'open' or new.category_id is null then return new; end if;

  select c.name into v_city_name
  from public.cities c
  where c.id = new.city_id;

  for v_supplier_user_id in
    select distinct sp.user_id
    from public.supplier_categories sc
    join public.supplier_profiles sp on sp.id = sc.supplier_id
    join public.profiles pr on pr.id = sp.user_id
    where sc.category_id = new.category_id
      and pr.role = 'supplier'
      and sp.user_id <> new.requester_id
      and public.can_supplier_view_request_for_matching(new.id, sp.user_id)
  loop
    perform public.create_system_notification(
      v_supplier_user_id,
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
