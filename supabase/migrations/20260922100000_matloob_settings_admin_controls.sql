-- MATLOOB: account settings, language-ready profile state, admin controls.

alter table public.profiles
  add column if not exists is_active boolean not null default true;

create or replace function public.prevent_profile_admin_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id and not public.is_admin(auth.uid()) then
    if new.is_active is distinct from old.is_active then
      raise exception 'لا يمكنك تغيير حالة الحساب.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_fields on public.profiles;
create trigger profiles_protect_admin_fields
before update on public.profiles
for each row execute function public.prevent_profile_admin_field_changes();

-- Refresh the admin user listing with the account status field.
drop function if exists public.get_admin_users(text, text, boolean, integer, integer);
create function public.get_admin_users(
  p_search text default null,
  p_role text default null,
  p_verified boolean default null,
  p_page integer default 1,
  p_page_size integer default 12
)
returns table (
  id uuid,
  full_name text,
  role text,
  created_at timestamptz,
  has_supplier_profile boolean,
  verified boolean,
  pro_status text,
  pro_expires_at timestamptz,
  is_active boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 12), 1), 100);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_role text := nullif(btrim(coalesce(p_role, '')), '');
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية الوصول إلى بيانات المستخدمين.' using errcode = '42501';
  end if;
  if v_role is not null and v_role not in ('requester', 'supplier') then
    raise exception 'دور المستخدم غير صالح.' using errcode = '22023';
  end if;
  return query
  with rows as (
    select
      p.id, p.full_name, p.role, p.created_at,
      (sp.id is not null) as has_supplier_profile,
      coalesce(sp.verified, false) as verified,
      case
        when p.role <> 'supplier' then null
        when exists (select 1 from public.subscriptions s join public.subscription_plans plan on plan.id=s.plan_id where s.user_id=p.id and plan.code='PRO' and s.status='active' and s.expires_at is not null and s.expires_at>now()) then 'active'
        when exists (select 1 from public.subscriptions s join public.subscription_plans plan on plan.id=s.plan_id where s.user_id=p.id and plan.code='PRO' and s.status='pending') then 'pending'
        when exists (select 1 from public.subscriptions s join public.subscription_plans plan on plan.id=s.plan_id where s.user_id=p.id and plan.code='PRO' and s.status='cancelled') then 'cancelled'
        when exists (select 1 from public.subscriptions s join public.subscription_plans plan on plan.id=s.plan_id where s.user_id=p.id and plan.code='PRO' and s.status='active' and s.expires_at is not null and s.expires_at<=now()) then 'expired'
        else 'free'
      end as pro_status,
      (select max(s.expires_at) from public.subscriptions s join public.subscription_plans plan on plan.id=s.plan_id where s.user_id=p.id and plan.code='PRO') as pro_expires_at,
      p.is_active
    from public.profiles p
    left join public.supplier_profiles sp on sp.user_id=p.id
    where (v_search is null or coalesce(p.full_name,'') ilike '%'||v_search||'%')
      and (v_role is null or p.role=v_role)
      and (p_verified is null or coalesce(sp.verified,false)=p_verified)
  )
  select r.*, count(*) over() as total_count
  from rows r
  order by r.created_at desc, r.id desc
  offset (v_page-1)*v_page_size limit v_page_size;
end;
$$;
revoke all on function public.get_admin_users(text,text,boolean,integer,integer) from public, anon;
grant execute on function public.get_admin_users(text,text,boolean,integer,integer) to authenticated;

create or replace function public.set_admin_user_active(p_user_id uuid, p_is_active boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة الحسابات.' using errcode='42501';
  end if;
  if p_user_id is null then raise exception 'معرف المستخدم مطلوب.' using errcode='22023'; end if;
  if exists (select 1 from public.admin_users where user_id=p_user_id) then
    raise exception 'لا يمكن إيقاف حساب إداري من هذه الواجهة.' using errcode='42501';
  end if;
  update public.profiles set is_active=coalesce(p_is_active,true) where id=p_user_id;
  if not found then raise exception 'المستخدم غير موجود.' using errcode='P0002'; end if;
  return p_is_active;
end;
$$;
revoke all on function public.set_admin_user_active(uuid,boolean) from public, anon;
grant execute on function public.set_admin_user_active(uuid,boolean) to authenticated;

create or replace function public.delete_admin_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية حذف الطلبات.' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'معرف الطلب مطلوب.' using errcode='22023'; end if;
  delete from public.requests where id=p_request_id;
  if not found then raise exception 'الطلب غير موجود.' using errcode='P0002'; end if;
  return true;
end;
$$;
revoke all on function public.delete_admin_request(uuid) from public, anon;
grant execute on function public.delete_admin_request(uuid) to authenticated;

create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'يجب تسجيل الدخول أولًا.' using errcode='42501'; end if;
  if exists (select 1 from public.admin_users where user_id=v_user_id) then
    raise exception 'لا يمكن حذف حساب إداري من هذه الواجهة.' using errcode='42501';
  end if;
  delete from auth.users where id=v_user_id;
  if not found then raise exception 'الحساب غير موجود.' using errcode='P0002'; end if;
  return true;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
