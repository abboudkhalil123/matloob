-- MATLOOB merged migration batch 3/3
-- Files preserved in original timestamp order:


-- ===== BEGIN ORIGINAL: 20260920100000_saved_requests.sql =====
-- MATLOOB Step 24: supplier saved requests
-- Database-side only. No historical migration is modified.

create table if not exists public.saved_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_profiles(id) on delete cascade,
  request_id uuid not null references public.requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_requests_supplier_request_unique unique (supplier_id, request_id)
);

create index if not exists saved_requests_supplier_id_idx
  on public.saved_requests (supplier_id);

create index if not exists saved_requests_request_id_idx
  on public.saved_requests (request_id);

create index if not exists saved_requests_supplier_created_at_idx
  on public.saved_requests (supplier_id, created_at desc);

alter table public.saved_requests enable row level security;

revoke all on table public.saved_requests from anon, authenticated;
grant select, delete on table public.saved_requests to authenticated;

-- The RPCs below are the only client-facing write path. They derive the supplier
-- profile from auth.uid() and never accept supplier_id from the client.
create or replace function public.save_request(p_request_id uuid)
returns public.saved_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_supplier_id uuid;
  v_request public.saved_requests;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select sp.id
    into v_supplier_id
  from public.supplier_profiles sp
  join public.profiles p on p.id = sp.user_id
  where sp.user_id = v_user_id
    and p.role = 'supplier'
  for update of sp;

  if v_supplier_id is null then
    raise exception 'هذه العملية متاحة للموردين فقط.';
  end if;

  if not exists (
    select 1
    from public.requests r
    where r.id = p_request_id
      and r.status = 'open'
  ) then
    raise exception 'لا يمكن حفظ هذا الطلب لأنه غير مفتوح أو غير موجود.';
  end if;

  if not public.can_supplier_view_request(p_request_id) then
    raise exception 'هذا الطلب غير متاح لك حاليًا.';
  end if;

  insert into public.saved_requests (supplier_id, request_id)
  values (v_supplier_id, p_request_id)
  on conflict (supplier_id, request_id) do nothing
  returning * into v_request;

  if v_request.id is null then
    select sr.*
      into v_request
    from public.saved_requests sr
    where sr.supplier_id = v_supplier_id
      and sr.request_id = p_request_id;
  end if;

  return v_request;
end;
$$;

create or replace function public.unsave_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_supplier_id uuid;
  v_deleted boolean := false;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select sp.id
    into v_supplier_id
  from public.supplier_profiles sp
  join public.profiles p on p.id = sp.user_id
  where sp.user_id = v_user_id
    and p.role = 'supplier';

  if v_supplier_id is null then
    raise exception 'هذه العملية متاحة للموردين فقط.';
  end if;

  delete from public.saved_requests
  where supplier_id = v_supplier_id
    and request_id = p_request_id;

  v_deleted := found;
  return v_deleted;
end;
$$;

create or replace function public.is_request_saved(p_request_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.saved_requests sr
    join public.supplier_profiles sp on sp.id = sr.supplier_id
    join public.profiles p on p.id = sp.user_id
    where sp.user_id = auth.uid()
      and p.role = 'supplier'
      and sr.request_id = p_request_id
  );
$$;

revoke all on function public.save_request(uuid) from public, anon;
revoke all on function public.unsave_request(uuid) from public, anon;
revoke all on function public.is_request_saved(uuid) from public, anon;
grant execute on function public.save_request(uuid) to authenticated;
grant execute on function public.unsave_request(uuid) to authenticated;
grant execute on function public.is_request_saved(uuid) to authenticated;

-- Direct SELECT is restricted to the current supplier's own saved rows.
-- Joined request data remains subject to the existing requests RLS.
drop policy if exists "saved_requests_select_own" on public.saved_requests;
create policy "saved_requests_select_own"
on public.saved_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.supplier_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.id = saved_requests.supplier_id
      and sp.user_id = auth.uid()
      and p.role = 'supplier'
  )
);

drop policy if exists "saved_requests_delete_own" on public.saved_requests;
create policy "saved_requests_delete_own"
on public.saved_requests
for delete
to authenticated
using (
  exists (
    select 1
    from public.supplier_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.id = saved_requests.supplier_id
      and sp.user_id = auth.uid()
      and p.role = 'supplier'
  )
);

-- No INSERT/UPDATE policy is created. INSERT is intentionally RPC-only.
-- No UPDATE privilege is granted to authenticated users.

-- ===== END ORIGINAL: 20260920100000_saved_requests.sql =====


-- ===== BEGIN ORIGINAL: 20260920110000_admin_dashboard.sql =====
-- MATLOOB Step 26: Read-only Admin Dashboard data access.
-- All administrative reads are guarded by the existing admin_users/is_admin() mechanism.
-- No admin role is added to profiles and no public admin provisioning is introduced.

create or replace function public.get_admin_stats()
returns table (
  total_users bigint,
  requester_users bigint,
  supplier_users bigint,
  total_requests bigint,
  open_requests bigint,
  completed_requests bigint,
  total_offers bigint,
  verified_suppliers bigint,
  active_pro_subscriptions bigint,
  pending_verification_requests bigint,
  pending_pro_subscriptions bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية الوصول إلى بيانات الإدارة.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where role = 'requester'),
    (select count(*) from public.profiles where role = 'supplier'),
    (select count(*) from public.requests),
    (select count(*) from public.requests where status = 'open'),
    (select count(*) from public.requests where status = 'completed'),
    (select count(*) from public.offers),
    (select count(*) from public.supplier_profiles where verified = true),
    (select count(*)
      from public.subscriptions s
      join public.subscription_plans p on p.id = s.plan_id
      where p.code = 'PRO'
        and s.status = 'active'
        and s.expires_at is not null
        and s.expires_at > now()),
    (select count(*) from public.verification_requests where status = 'pending'),
    (select count(*)
      from public.subscriptions s
      join public.subscription_plans p on p.id = s.plan_id
      where p.code = 'PRO' and s.status = 'pending');
end;
$$;

revoke all on function public.get_admin_stats() from public;
revoke all on function public.get_admin_stats() from anon;
grant execute on function public.get_admin_stats() to authenticated;

create or replace function public.get_admin_users(
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
      p.id,
      p.full_name,
      p.role,
      p.created_at,
      (sp.id is not null) as has_supplier_profile,
      coalesce(sp.verified, false) as verified,
      case
        when p.role <> 'supplier' then null
        when exists (
          select 1
          from public.subscriptions s
          join public.subscription_plans plan on plan.id = s.plan_id
          where s.user_id = p.id
            and plan.code = 'PRO'
            and s.status = 'active'
            and s.expires_at is not null
            and s.expires_at > now()
        ) then 'active'
        when exists (
          select 1
          from public.subscriptions s
          join public.subscription_plans plan on plan.id = s.plan_id
          where s.user_id = p.id
            and plan.code = 'PRO'
            and s.status = 'pending'
        ) then 'pending'
        when exists (
          select 1
          from public.subscriptions s
          join public.subscription_plans plan on plan.id = s.plan_id
          where s.user_id = p.id
            and plan.code = 'PRO'
            and s.status = 'cancelled'
        ) then 'cancelled'
        when exists (
          select 1
          from public.subscriptions s
          join public.subscription_plans plan on plan.id = s.plan_id
          where s.user_id = p.id
            and plan.code = 'PRO'
            and s.status = 'active'
            and s.expires_at is not null
            and s.expires_at <= now()
        ) then 'expired'
        else 'free'
      end as pro_status,
      (
        select max(s.expires_at)
        from public.subscriptions s
        join public.subscription_plans plan on plan.id = s.plan_id
        where s.user_id = p.id and plan.code = 'PRO'
      ) as pro_expires_at
    from public.profiles p
    left join public.supplier_profiles sp on sp.user_id = p.id
    where (v_search is null or p.full_name ilike '%' || v_search || '%')
      and (v_role is null or p.role = v_role)
      and (p_verified is null or (p.role = 'supplier' and coalesce(sp.verified, false) = p_verified))
  )
  select r.*, count(*) over() as total_count
  from rows r
  order by r.created_at desc, r.id desc
  offset (v_page - 1) * v_page_size
  limit v_page_size;
end;
$$;

revoke all on function public.get_admin_users(text, text, boolean, integer, integer) from public;
revoke all on function public.get_admin_users(text, text, boolean, integer, integer) from anon;
grant execute on function public.get_admin_users(text, text, boolean, integer, integer) to authenticated;

create or replace function public.get_admin_requests(
  p_search text default null,
  p_status text default null,
  p_category_id uuid default null,
  p_city_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 12
)
returns table (
  id uuid,
  title text,
  requester_name text,
  category_id uuid,
  category_name text,
  city_id uuid,
  city_name text,
  status text,
  created_at timestamptz,
  offer_count bigint,
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
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية الوصول إلى بيانات الطلبات.' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('open', 'closed', 'supplier_selected', 'in_progress', 'completed', 'cancelled') then
    raise exception 'حالة الطلب غير صالحة.' using errcode = '22023';
  end if;

  return query
  with rows as (
    select
      r.id,
      r.title,
      p.full_name as requester_name,
      r.category_id,
      c.name as category_name,
      r.city_id,
      city.name as city_name,
      r.status,
      r.created_at,
      (select count(*) from public.offers o where o.request_id = r.id) as offer_count
    from public.requests r
    join public.profiles p on p.id = r.requester_id
    join public.categories c on c.id = r.category_id
    join public.cities city on city.id = r.city_id
    where (v_search is null or r.title ilike '%' || v_search || '%' or r.description ilike '%' || v_search || '%')
      and (p_status is null or r.status = p_status)
      and (p_category_id is null or r.category_id = p_category_id)
      and (p_city_id is null or r.city_id = p_city_id)
  )
  select r.*, count(*) over() as total_count
  from rows r
  order by r.created_at desc, r.id desc
  offset (v_page - 1) * v_page_size
  limit v_page_size;
end;
$$;

revoke all on function public.get_admin_requests(text, text, uuid, uuid, integer, integer) from public;
revoke all on function public.get_admin_requests(text, text, uuid, uuid, integer, integer) from anon;
grant execute on function public.get_admin_requests(text, text, uuid, uuid, integer, integer) to authenticated;

create or replace function public.get_admin_suppliers(
  p_search text default null,
  p_city_id uuid default null,
  p_verified boolean default null,
  p_page integer default 1,
  p_page_size integer default 12
)
returns table (
  id uuid,
  user_id uuid,
  supplier_name text,
  company_name text,
  business_type text,
  city_id uuid,
  city_name text,
  verified boolean,
  review_count bigint,
  rating_average numeric,
  pro_status text,
  created_at timestamptz,
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
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية الوصول إلى بيانات الموردين.' using errcode = '42501';
  end if;

  return query
  with rows as (
    select
      sp.id,
      sp.user_id,
      p.full_name as supplier_name,
      sp.company_name,
      sp.business_type,
      sp.city_id,
      city.name as city_name,
      coalesce(sp.verified, false) as verified,
      (select count(*) from public.reviews rv where rv.reviewed_supplier_id = sp.user_id) as review_count,
      (select avg(rv.rating)::numeric(10,2) from public.reviews rv where rv.reviewed_supplier_id = sp.user_id) as rating_average,
      case
        when exists (
          select 1
          from public.subscriptions s
          join public.subscription_plans plan on plan.id = s.plan_id
          where s.user_id = sp.user_id
            and plan.code = 'PRO'
            and s.status = 'active'
            and s.expires_at is not null
            and s.expires_at > now()
        ) then 'active'
        when exists (
          select 1
          from public.subscriptions s
          join public.subscription_plans plan on plan.id = s.plan_id
          where s.user_id = sp.user_id
            and plan.code = 'PRO'
            and s.status = 'pending'
        ) then 'pending'
        when exists (
          select 1
          from public.subscriptions s
          join public.subscription_plans plan on plan.id = s.plan_id
          where s.user_id = sp.user_id
            and plan.code = 'PRO'
            and s.status = 'cancelled'
        ) then 'cancelled'
        when exists (
          select 1
          from public.subscriptions s
          join public.subscription_plans plan on plan.id = s.plan_id
          where s.user_id = sp.user_id
            and plan.code = 'PRO'
            and s.status = 'active'
            and s.expires_at is not null
            and s.expires_at <= now()
        ) then 'expired'
        else 'free'
      end as pro_status,
      sp.created_at
    from public.supplier_profiles sp
    join public.profiles p on p.id = sp.user_id and p.role = 'supplier'
    left join public.cities city on city.id = sp.city_id
    where (v_search is null or sp.company_name ilike '%' || v_search || '%' or sp.business_type ilike '%' || v_search || '%')
      and (p_city_id is null or sp.city_id = p_city_id)
      and (p_verified is null or coalesce(sp.verified, false) = p_verified)
  )
  select r.*, count(*) over() as total_count
  from rows r
  order by r.created_at desc, r.id desc
  offset (v_page - 1) * v_page_size
  limit v_page_size;
end;
$$;

revoke all on function public.get_admin_suppliers(text, uuid, boolean, integer, integer) from public;
revoke all on function public.get_admin_suppliers(text, uuid, boolean, integer, integer) from anon;
grant execute on function public.get_admin_suppliers(text, uuid, boolean, integer, integer) to authenticated;

-- ===== END ORIGINAL: 20260920110000_admin_dashboard.sql =====


-- ===== BEGIN ORIGINAL: 20260920120000_admin_categories_cities.sql =====
-- MATLOOB Step 27: Admin management for categories and cities
-- Admin authority is the existing admin_users + is_admin() model.
-- Existing rows are never deleted by these RPCs; deactivation uses is_active.

alter table public.categories
  add column if not exists is_active boolean not null default true;

alter table public.cities
  add column if not exists is_active boolean not null default true;

-- Keep direct client writes disabled. Authenticated users retain read access.
revoke insert, update, delete on public.categories from anon, authenticated;
revoke insert, update, delete on public.cities from anon, authenticated;

-- New requests may reference only active reference data. Existing rows are preserved.
create or replace function public.enforce_active_request_references()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.categories c where c.id = new.category_id and c.is_active) then
      raise exception 'التصنيف المحدد غير فعال.' using errcode = '23514';
    end if;
    if not exists (select 1 from public.cities c where c.id = new.city_id and c.is_active) then
      raise exception 'المدينة المحددة غير فعالة.' using errcode = '23514';
    end if;
  else
    if new.category_id is distinct from old.category_id and not exists (select 1 from public.categories c where c.id = new.category_id and c.is_active) then
      raise exception 'التصنيف المحدد غير فعال.' using errcode = '23514';
    end if;
    if new.city_id is distinct from old.city_id and not exists (select 1 from public.cities c where c.id = new.city_id and c.is_active) then
      raise exception 'المدينة المحددة غير فعالة.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists requests_enforce_active_references on public.requests;
create trigger requests_enforce_active_references
before insert or update of category_id, city_id on public.requests
for each row
execute function public.enforce_active_request_references();

-- A supplier may keep existing inactive category/city references, but cannot add/change to an inactive one.
create or replace function public.enforce_active_supplier_references()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' or new.city_id is distinct from old.city_id then
    if new.city_id is not null and not exists (select 1 from public.cities c where c.id = new.city_id and c.is_active) then
      raise exception 'المدينة المحددة غير فعالة.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_profiles_enforce_active_references on public.supplier_profiles;
create trigger supplier_profiles_enforce_active_references
before insert or update of city_id on public.supplier_profiles
for each row
execute function public.enforce_active_supplier_references();

create or replace function public.enforce_active_supplier_category()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not exists (select 1 from public.categories c where c.id = new.category_id and c.is_active) then
    raise exception 'لا يمكن إضافة تصنيف غير فعال إلى ملف المورد.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_categories_enforce_active_category on public.supplier_categories;
create trigger supplier_categories_enforce_active_category
before insert on public.supplier_categories
for each row
execute function public.enforce_active_supplier_category();

-- Categories -----------------------------------------------------------------
create or replace function public.get_admin_categories(
  p_search text default null,
  p_is_active boolean default null,
  p_page integer default 1,
  p_page_size integer default 12
)
returns table (
  id uuid,
  name text,
  slug text,
  is_active boolean,
  created_at timestamptz,
  request_count bigint,
  supplier_count bigint,
  usage_count bigint,
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
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة التصنيفات.' using errcode = '42501';
  end if;

  return query
  with rows as (
    select
      c.id,
      c.name,
      c.slug,
      c.is_active,
      c.created_at,
      (select count(*) from public.requests r where r.category_id = c.id) as request_count,
      (select count(*) from public.supplier_categories sc where sc.category_id = c.id) as supplier_count
    from public.categories c
    where (v_search is null or c.name ilike '%' || v_search || '%' or c.slug ilike '%' || v_search || '%')
      and (p_is_active is null or c.is_active = p_is_active)
  )
  select r.*, (r.request_count + r.supplier_count) as usage_count, count(*) over() as total_count
  from rows r
  order by r.name asc, r.id asc
  offset (v_page - 1) * v_page_size
  limit v_page_size;
end;
$$;

create or replace function public.create_admin_category(
  p_name text,
  p_slug text
)
returns public.categories
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_category public.categories;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة التصنيفات.' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'اسم التصنيف مطلوب.' using errcode = '22023';
  end if;
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'صيغة slug غير صالحة.' using errcode = '22023';
  end if;

  insert into public.categories (name, slug, is_active)
  values (v_name, v_slug, true)
  returning * into v_category;
  return v_category;
exception
  when unique_violation then
    raise exception 'اسم التصنيف أو slug مستخدم مسبقًا.' using errcode = '23505';
end;
$$;

create or replace function public.update_admin_category(
  p_category_id uuid,
  p_name text,
  p_slug text
)
returns public.categories
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_category public.categories;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة التصنيفات.' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'اسم التصنيف مطلوب.' using errcode = '22023';
  end if;
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'صيغة slug غير صالحة.' using errcode = '22023';
  end if;

  update public.categories
  set name = v_name, slug = v_slug
  where id = p_category_id
  returning * into v_category;

  if not found then
    raise exception 'التصنيف غير موجود.' using errcode = 'P0002';
  end if;
  return v_category;
exception
  when unique_violation then
    raise exception 'اسم التصنيف أو slug مستخدم مسبقًا.' using errcode = '23505';
end;
$$;

create or replace function public.set_admin_category_active(
  p_category_id uuid,
  p_is_active boolean
)
returns public.categories
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_category public.categories;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة التصنيفات.' using errcode = '42501';
  end if;

  update public.categories
  set is_active = coalesce(p_is_active, false)
  where id = p_category_id
  returning * into v_category;

  if not found then
    raise exception 'التصنيف غير موجود.' using errcode = 'P0002';
  end if;
  return v_category;
end;
$$;

-- Cities ---------------------------------------------------------------------
create or replace function public.get_admin_cities(
  p_search text default null,
  p_is_active boolean default null,
  p_page integer default 1,
  p_page_size integer default 12
)
returns table (
  id uuid,
  name text,
  is_active boolean,
  created_at timestamptz,
  request_count bigint,
  supplier_count bigint,
  usage_count bigint,
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
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة المدن.' using errcode = '42501';
  end if;

  return query
  with rows as (
    select
      c.id,
      c.name,
      c.is_active,
      c.created_at,
      (select count(*) from public.requests r where r.city_id = c.id) as request_count,
      (select count(*) from public.supplier_profiles sp where sp.city_id = c.id) as supplier_count
    from public.cities c
    where (v_search is null or c.name ilike '%' || v_search || '%')
      and (p_is_active is null or c.is_active = p_is_active)
  )
  select r.*, (r.request_count + r.supplier_count) as usage_count, count(*) over() as total_count
  from rows r
  order by r.name asc, r.id asc
  offset (v_page - 1) * v_page_size
  limit v_page_size;
end;
$$;

create or replace function public.create_admin_city(p_name text)
returns public.cities
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_city public.cities;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة المدن.' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'اسم المدينة مطلوب.' using errcode = '22023';
  end if;

  insert into public.cities (name, is_active)
  values (v_name, true)
  returning * into v_city;
  return v_city;
exception
  when unique_violation then
    raise exception 'اسم المدينة مستخدم مسبقًا.' using errcode = '23505';
end;
$$;

create or replace function public.update_admin_city(
  p_city_id uuid,
  p_name text
)
returns public.cities
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_city public.cities;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة المدن.' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'اسم المدينة مطلوب.' using errcode = '22023';
  end if;

  update public.cities
  set name = v_name
  where id = p_city_id
  returning * into v_city;

  if not found then
    raise exception 'المدينة غير موجودة.' using errcode = 'P0002';
  end if;
  return v_city;
exception
  when unique_violation then
    raise exception 'اسم المدينة مستخدم مسبقًا.' using errcode = '23505';
end;
$$;

create or replace function public.set_admin_city_active(
  p_city_id uuid,
  p_is_active boolean
)
returns public.cities
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_city public.cities;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة المدن.' using errcode = '42501';
  end if;

  update public.cities
  set is_active = coalesce(p_is_active, false)
  where id = p_city_id
  returning * into v_city;

  if not found then
    raise exception 'المدينة غير موجودة.' using errcode = 'P0002';
  end if;
  return v_city;
end;
$$;

revoke all on function public.get_admin_categories(text, boolean, integer, integer) from public, anon;
revoke all on function public.create_admin_category(text, text) from public, anon;
revoke all on function public.update_admin_category(uuid, text, text) from public, anon;
revoke all on function public.set_admin_category_active(uuid, boolean) from public, anon;
revoke all on function public.get_admin_cities(text, boolean, integer, integer) from public, anon;
revoke all on function public.create_admin_city(text) from public, anon;
revoke all on function public.update_admin_city(uuid, text) from public, anon;
revoke all on function public.set_admin_city_active(uuid, boolean) from public, anon;

grant execute on function public.get_admin_categories(text, boolean, integer, integer) to authenticated;
grant execute on function public.create_admin_category(text, text) to authenticated;
grant execute on function public.update_admin_category(uuid, text, text) to authenticated;
grant execute on function public.set_admin_category_active(uuid, boolean) to authenticated;
grant execute on function public.get_admin_cities(text, boolean, integer, integer) to authenticated;
grant execute on function public.create_admin_city(text) to authenticated;
grant execute on function public.update_admin_city(uuid, text) to authenticated;
grant execute on function public.set_admin_city_active(uuid, boolean) to authenticated;

-- ===== END ORIGINAL: 20260920120000_admin_categories_cities.sql =====


-- ===== BEGIN ORIGINAL: 20260920130000_admin_reports.sql =====
-- MATLOOB Step 28: Admin reports and advanced statistics.
-- Uses only existing platform data and the existing admin_users/is_admin() security model.

create or replace function public.get_admin_report_summary(
  p_from timestamptz default null,
  p_to_exclusive timestamptz default null
)
returns table (
  total_users bigint, new_users bigint, requester_users bigint, supplier_users bigint,
  total_requests bigint, new_requests bigint, open_requests bigint, in_progress_requests bigint,
  completed_requests bigint, cancelled_requests bigint, supplier_selected_requests bigint,
  total_offers bigint, new_offers bigint, average_offers_per_request numeric,
  requests_with_offers bigint, total_suppliers bigint, new_suppliers bigint,
  verified_suppliers bigint, unverified_suppliers bigint, active_pro_suppliers bigint
)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية الوصول إلى التقارير.' using errcode = '42501';
  end if;
  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles p where (p_from is null or p.created_at >= p_from) and (p_to_exclusive is null or p.created_at < p_to_exclusive)),
    (select count(*) from public.profiles where role = 'requester'),
    (select count(*) from public.profiles where role = 'supplier'),
    (select count(*) from public.requests),
    (select count(*) from public.requests r where (p_from is null or r.created_at >= p_from) and (p_to_exclusive is null or r.created_at < p_to_exclusive)),
    (select count(*) from public.requests where status = 'open'),
    (select count(*) from public.requests where status = 'in_progress'),
    (select count(*) from public.requests where status = 'completed'),
    (select count(*) from public.requests where status = 'cancelled'),
    (select count(*) from public.requests where status = 'supplier_selected'),
    (select count(*) from public.offers),
    (select count(*) from public.offers o where (p_from is null or o.created_at >= p_from) and (p_to_exclusive is null or o.created_at < p_to_exclusive)),
    coalesce((select avg(x.offer_count)::numeric from (select r.id, count(o.id)::numeric as offer_count from public.requests r left join public.offers o on o.request_id = r.id group by r.id) x), 0),
    (select count(*) from public.requests r where exists (select 1 from public.offers o where o.request_id = r.id)),
    (select count(*) from public.supplier_profiles),
    (select count(*) from public.supplier_profiles sp where (p_from is null or sp.created_at >= p_from) and (p_to_exclusive is null or sp.created_at < p_to_exclusive)),
    (select count(*) from public.supplier_profiles where verified = true),
    (select count(*) from public.supplier_profiles where coalesce(verified, false) = false),
    (select count(*) from public.subscriptions s join public.subscription_plans plan on plan.id = s.plan_id join public.profiles p on p.id = s.user_id where plan.code = 'PRO' and p.role = 'supplier' and s.status = 'active' and s.expires_at is not null and s.expires_at > now());
end;
$$;
revoke all on function public.get_admin_report_summary(timestamptz,timestamptz) from public, anon;
grant execute on function public.get_admin_report_summary(timestamptz,timestamptz) to authenticated;

create or replace function public.get_admin_request_funnel(p_from timestamptz default null, p_to_exclusive timestamptz default null)
returns table (requests_created bigint, requests_with_offers bigint, requests_with_selected_supplier bigint, requests_started bigint, requests_completed bigint, offers_rate numeric, selection_rate numeric, start_rate numeric, completion_rate numeric)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_created bigint; v_offers bigint; v_selected bigint; v_started bigint; v_completed bigint;
begin
  if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى التقارير.' using errcode='42501'; end if;
  select count(*) into v_created from public.requests r where (p_from is null or r.created_at >= p_from) and (p_to_exclusive is null or r.created_at < p_to_exclusive);
  select count(*) into v_offers from public.requests r where (p_from is null or r.created_at >= p_from) and (p_to_exclusive is null or r.created_at < p_to_exclusive) and exists (select 1 from public.offers o where o.request_id=r.id);
  select count(*) into v_selected from public.requests r where (p_from is null or r.created_at >= p_from) and (p_to_exclusive is null or r.created_at < p_to_exclusive) and r.selected_offer_id is not null;
  select count(*) into v_started from public.requests r where (p_from is null or r.created_at >= p_from) and (p_to_exclusive is null or r.created_at < p_to_exclusive) and r.status in ('in_progress','completed');
  select count(*) into v_completed from public.requests r where (p_from is null or r.created_at >= p_from) and (p_to_exclusive is null or r.created_at < p_to_exclusive) and r.status='completed';
  return query select v_created,v_offers,v_selected,v_started,v_completed,
    case when v_created=0 then null else round(v_offers::numeric/v_created*100,1) end,
    case when v_created=0 then null else round(v_selected::numeric/v_created*100,1) end,
    case when v_created=0 then null else round(v_started::numeric/v_created*100,1) end,
    case when v_created=0 then null else round(v_completed::numeric/v_created*100,1) end;
end; $$;
revoke all on function public.get_admin_request_funnel(timestamptz,timestamptz) from public, anon;
grant execute on function public.get_admin_request_funnel(timestamptz,timestamptz) to authenticated;

create or replace function public.get_admin_offer_analytics(p_from timestamptz default null, p_to_exclusive timestamptz default null)
returns table (average_offers_per_request numeric, max_offers_on_request bigint, requests_without_offers bigint, requests_with_one_offer bigint, requests_with_more_than_one_offer bigint)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى التقارير.' using errcode='42501'; end if;
  return query
  with rc as (
    select r.id, count(o.id)::bigint offer_count from public.requests r left join public.offers o on o.request_id=r.id
    where (p_from is null or r.created_at >= p_from) and (p_to_exclusive is null or r.created_at < p_to_exclusive) group by r.id
  )
  select coalesce(avg(offer_count)::numeric,0), coalesce(max(offer_count),0), count(*) filter(where offer_count=0), count(*) filter(where offer_count=1), count(*) filter(where offer_count>1) from rc;
end; $$;
revoke all on function public.get_admin_offer_analytics(timestamptz,timestamptz) from public, anon;
grant execute on function public.get_admin_offer_analytics(timestamptz,timestamptz) to authenticated;

create or replace function public.get_admin_top_categories(p_from timestamptz default null, p_to_exclusive timestamptz default null, p_page integer default 1, p_page_size integer default 12)
returns table (id uuid, name text, request_count bigint, offer_count bigint, supplier_count bigint, total_count bigint)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_page int:=greatest(coalesce(p_page,1),1); v_size int:=least(greatest(coalesce(p_page_size,12),1),100);
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى التقارير.' using errcode='42501'; end if;
 return query with rows as (
   select c.id,c.name,
    (select count(*) from public.requests r where r.category_id=c.id and (p_from is null or r.created_at>=p_from) and (p_to_exclusive is null or r.created_at<p_to_exclusive)) request_count,
    (select count(*) from public.offers o join public.requests r on r.id=o.request_id where r.category_id=c.id and (p_from is null or o.created_at>=p_from) and (p_to_exclusive is null or o.created_at<p_to_exclusive)) offer_count,
    (select count(*) from public.supplier_categories sc where sc.category_id=c.id) supplier_count
   from public.categories c
 ) select r.*,count(*) over() from rows r order by r.request_count desc,r.name asc offset (v_page-1)*v_size limit v_size;
end; $$;
revoke all on function public.get_admin_top_categories(timestamptz,timestamptz,integer,integer) from public, anon;
grant execute on function public.get_admin_top_categories(timestamptz,timestamptz,integer,integer) to authenticated;

create or replace function public.get_admin_top_cities(p_from timestamptz default null, p_to_exclusive timestamptz default null, p_page integer default 1, p_page_size integer default 12)
returns table (id uuid, name text, request_count bigint, supplier_count bigint, completed_request_count bigint, total_count bigint)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_page int:=greatest(coalesce(p_page,1),1); v_size int:=least(greatest(coalesce(p_page_size,12),1),100);
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى التقارير.' using errcode='42501'; end if;
 return query with rows as (
   select c.id,c.name,
    count(distinct r.id) filter(where p_from is null or r.created_at>=p_from and (p_to_exclusive is null or r.created_at<p_to_exclusive)) request_count,
    count(distinct sp.id) supplier_count,
    count(distinct r.id) filter(where r.status='completed' and (p_from is null or r.created_at>=p_from) and (p_to_exclusive is null or r.created_at<p_to_exclusive)) completed_request_count
   from public.cities c
   left join public.requests r on r.city_id=c.id
   left join public.supplier_profiles sp on sp.city_id=c.id
   group by c.id,c.name
 ) select r.*,count(*) over() from rows r order by r.request_count desc,r.name asc offset (v_page-1)*v_size limit v_size;
end; $$;
revoke all on function public.get_admin_top_cities(timestamptz,timestamptz,integer,integer) from public, anon;
grant execute on function public.get_admin_top_cities(timestamptz,timestamptz,integer,integer) to authenticated;

create or replace function public.get_admin_active_suppliers(p_from timestamptz default null, p_to_exclusive timestamptz default null, p_page integer default 1, p_page_size integer default 12)
returns table (user_id uuid, supplier_name text, offer_count bigint, selected_offer_count bigint, completed_request_count bigint, rating_average numeric, verified boolean, is_pro boolean, total_count bigint)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_page int:=greatest(coalesce(p_page,1),1); v_size int:=least(greatest(coalesce(p_page_size,12),1),100);
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى التقارير.' using errcode='42501'; end if;
 return query with rows as (
   select p.id user_id, coalesce(sp.company_name,p.full_name,'مورد') supplier_name,
    count(o.id) filter(where p_from is null or o.created_at>=p_from and (p_to_exclusive is null or o.created_at<p_to_exclusive)) offer_count,
    count(o.id) filter(where r.selected_offer_id=o.id and (p_from is null or r.created_at>=p_from) and (p_to_exclusive is null or r.created_at<p_to_exclusive)) selected_offer_count,
    count(distinct r.id) filter(where r.status='completed' and r.selected_offer_id=o.id and (p_from is null or r.created_at>=p_from) and (p_to_exclusive is null or r.created_at<p_to_exclusive)) completed_request_count,
    (select avg(rv.rating)::numeric from public.reviews rv where rv.reviewed_supplier_id=p.id) rating_average,
    coalesce(sp.verified,false) verified,
    exists(select 1 from public.subscriptions s join public.subscription_plans plan on plan.id=s.plan_id where s.user_id=p.id and plan.code='PRO' and s.status='active' and s.expires_at>now()) is_pro
   from public.profiles p join public.supplier_profiles sp on sp.user_id=p.id
   left join public.offers o on o.supplier_id=sp.id
   left join public.requests r on r.id=o.request_id
   where p.role='supplier'
   group by p.id,p.full_name,sp.company_name,sp.verified
 ) select r.*,count(*) over() from rows r order by r.offer_count desc,r.user_id offset (v_page-1)*v_size limit v_size;
end; $$;
revoke all on function public.get_admin_active_suppliers(timestamptz,timestamptz,integer,integer) from public, anon;
grant execute on function public.get_admin_active_suppliers(timestamptz,timestamptz,integer,integer) to authenticated;

create or replace function public.get_admin_activity_over_time(p_from timestamptz default null, p_to_exclusive timestamptz default null, p_granularity text default 'day')
returns table (bucket timestamptz, request_count bigint, offer_count bigint, new_user_count bigint)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_from timestamptz:=coalesce(p_from,'1900-01-01'::timestamptz); v_to timestamptz:=coalesce(p_to_exclusive,now()+interval '1 day'); v_step interval; v_trunc text;
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى التقارير.' using errcode='42501'; end if;
 if p_granularity not in ('day','month') then raise exception 'تجميع زمني غير صالح.' using errcode='22023'; end if;
 v_step:=case when p_granularity='day' then interval '1 day' else interval '1 month' end; v_trunc:=p_granularity;
 return query
 with series as (select generate_series(date_trunc(v_trunc,v_from), date_trunc(v_trunc,v_to-v_step), v_step) as bucket)
 select s.bucket,
   (select count(*) from public.requests r where date_trunc(v_trunc,r.created_at)=s.bucket and r.created_at>=v_from and r.created_at<v_to),
   (select count(*) from public.offers o where date_trunc(v_trunc,o.created_at)=s.bucket and o.created_at>=v_from and o.created_at<v_to),
   (select count(*) from public.profiles p where date_trunc(v_trunc,p.created_at)=s.bucket and p.created_at>=v_from and p.created_at<v_to)
 from series s order by s.bucket;
end; $$;
revoke all on function public.get_admin_activity_over_time(timestamptz,timestamptz,text) from public, anon;
grant execute on function public.get_admin_activity_over_time(timestamptz,timestamptz,text) to authenticated;

create or replace function public.get_admin_status_distribution(p_from timestamptz default null, p_to_exclusive timestamptz default null)
returns table (status text, request_count bigint)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى التقارير.' using errcode='42501'; end if;
 return query select s.status,count(r.id) from (values ('open'),('supplier_selected'),('in_progress'),('completed'),('cancelled'),('closed')) s(status) left join public.requests r on r.status=s.status and (p_from is null or r.created_at>=p_from) and (p_to_exclusive is null or r.created_at<p_to_exclusive) group by s.status order by case s.status when 'open' then 1 when 'supplier_selected' then 2 when 'in_progress' then 3 when 'completed' then 4 when 'cancelled' then 5 else 6 end;
end; $$;
revoke all on function public.get_admin_status_distribution(timestamptz,timestamptz) from public, anon;
grant execute on function public.get_admin_status_distribution(timestamptz,timestamptz) to authenticated;

create or replace function public.get_admin_pro_analytics(p_from timestamptz default null, p_to_exclusive timestamptz default null)
returns table (active_pro bigint, pending_pro bigint, expired_pro bigint, expired_during_period bigint, pro_activations_during_period bigint)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى التقارير.' using errcode='42501'; end if;
 return query select
  (select count(*) from public.subscriptions s join public.subscription_plans p on p.id=s.plan_id where p.code='PRO' and s.status='active' and s.expires_at>now()),
  (select count(*) from public.subscriptions s join public.subscription_plans p on p.id=s.plan_id where p.code='PRO' and s.status='pending'),
  (select count(*) from public.subscriptions s join public.subscription_plans p on p.id=s.plan_id where p.code='PRO' and s.status='active' and s.expires_at is not null and s.expires_at<=now()),
  (select count(*) from public.subscriptions s join public.subscription_plans p on p.id=s.plan_id where p.code='PRO' and s.status='active' and s.expires_at is not null and s.expires_at<=now() and (p_from is null or s.expires_at>=p_from) and (p_to_exclusive is null or s.expires_at<p_to_exclusive)),
  (select count(*) from public.subscriptions s join public.subscription_plans p on p.id=s.plan_id where p.code='PRO' and s.created_at>=coalesce(p_from,s.created_at) and (p_to_exclusive is null or s.created_at<p_to_exclusive));
end; $$;
revoke all on function public.get_admin_pro_analytics(timestamptz,timestamptz) from public, anon;
grant execute on function public.get_admin_pro_analytics(timestamptz,timestamptz) to authenticated;

create or replace function public.get_admin_verification_analytics(p_from timestamptz default null, p_to_exclusive timestamptz default null)
returns table (pending bigint, approved bigint, rejected bigint, cancelled bigint, created_during_period bigint)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى التقارير.' using errcode='42501'; end if;
 return query select
  (select count(*) from public.verification_requests where status='pending'),
  (select count(*) from public.verification_requests where status='approved'),
  (select count(*) from public.verification_requests where status='rejected'),
  (select count(*) from public.verification_requests where status='cancelled'),
  (select count(*) from public.verification_requests where (p_from is null or created_at>=p_from) and (p_to_exclusive is null or created_at<p_to_exclusive));
end; $$;
revoke all on function public.get_admin_verification_analytics(timestamptz,timestamptz) from public, anon;
grant execute on function public.get_admin_verification_analytics(timestamptz,timestamptz) to authenticated;

-- Useful date indexes for the new reporting workload. Existing indexes are preserved.
create index if not exists profiles_created_at_idx on public.profiles(created_at);
create index if not exists requests_created_at_idx on public.requests(created_at);
create index if not exists offers_created_at_idx on public.offers(created_at);
create index if not exists supplier_profiles_created_at_idx on public.supplier_profiles(created_at);
create index if not exists subscriptions_created_at_idx on public.subscriptions(created_at);
create index if not exists verification_requests_created_at_idx on public.verification_requests(created_at);

-- ===== END ORIGINAL: 20260920130000_admin_reports.sql =====


-- ===== BEGIN ORIGINAL: 20260920140000_support_system.sql =====
-- MATLOOB Step 29: Support / Tickets system.

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 1 and 200),
  category text not null check (category in ('account','request','offer','supplier','verification','subscription','technical','other')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_user','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index support_tickets_user_id_idx on public.support_tickets(user_id);
create index support_tickets_status_idx on public.support_tickets(status);
create index support_tickets_priority_idx on public.support_tickets(priority);
create index support_tickets_created_at_idx on public.support_tickets(created_at desc);
create index support_messages_ticket_id_idx on public.support_messages(ticket_id);
create index support_messages_created_at_idx on public.support_messages(created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

revoke all on table public.support_tickets from anon, authenticated;
revoke all on table public.support_messages from anon, authenticated;
grant select on table public.support_tickets to authenticated;
grant select on table public.support_messages to authenticated;

drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets
for select to authenticated using (user_id = auth.uid());

drop policy if exists support_messages_select_own on public.support_messages;
create policy support_messages_select_own on public.support_messages
for select to authenticated using (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
);

create or replace function public.support_touch_updated_at()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin new.updated_at = now(); return new; end; $$;
revoke all on function public.support_touch_updated_at() from public, anon, authenticated;
drop trigger if exists support_tickets_touch_updated_at on public.support_tickets;
create trigger support_tickets_touch_updated_at before update on public.support_tickets for each row execute function public.support_touch_updated_at();

create or replace function public.create_support_ticket(p_subject text, p_category text, p_message text)
returns public.support_tickets
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_ticket public.support_tickets;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول.' using errcode = '42501'; end if;
  if p_category not in ('account','request','offer','supplier','verification','subscription','technical','other') then raise exception 'تصنيف التذكرة غير صالح.'; end if;
  if char_length(btrim(coalesce(p_subject,''))) not between 1 and 200 then raise exception 'عنوان التذكرة يجب أن يكون بين 1 و200 محرف.'; end if;
  if char_length(btrim(coalesce(p_message,''))) not between 1 and 5000 then raise exception 'رسالة الدعم يجب أن تكون بين 1 و5000 محرف.'; end if;
  insert into public.support_tickets(user_id,subject,category) values(auth.uid(),btrim(p_subject),p_category) returning * into v_ticket;
  insert into public.support_messages(ticket_id,sender_id,message) values(v_ticket.id,auth.uid(),btrim(p_message));
  return v_ticket;
end; $$;
revoke all on function public.create_support_ticket(text,text,text) from public, anon;
grant execute on function public.create_support_ticket(text,text,text) to authenticated;

create or replace function public.add_support_message(p_ticket_id uuid, p_message text)
returns public.support_messages
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_ticket public.support_tickets; v_message public.support_messages;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول.' using errcode = '42501'; end if;
  select * into v_ticket from public.support_tickets where id = p_ticket_id and user_id = auth.uid();
  if not found then raise exception 'التذكرة غير موجودة.' using errcode = '42501'; end if;
  if v_ticket.status in ('resolved','closed') then raise exception 'لا يمكن الرد على تذكرة محلولة أو مغلقة.'; end if;
  if char_length(btrim(coalesce(p_message,''))) not between 1 and 5000 then raise exception 'رسالة الدعم يجب أن تكون بين 1 و5000 محرف.'; end if;
  insert into public.support_messages(ticket_id,sender_id,message) values(p_ticket_id,auth.uid(),btrim(p_message)) returning * into v_message;
  return v_message;
end; $$;
revoke all on function public.add_support_message(uuid,text) from public, anon;
grant execute on function public.add_support_message(uuid,text) to authenticated;

create or replace function public.reopen_support_ticket(p_ticket_id uuid)
returns public.support_tickets
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_ticket public.support_tickets;
begin
  select * into v_ticket from public.support_tickets where id=p_ticket_id and user_id=auth.uid();
  if not found then raise exception 'التذكرة غير موجودة.' using errcode='42501'; end if;
  if v_ticket.status not in ('resolved','closed') then raise exception 'التذكرة مفتوحة بالفعل.'; end if;
  update public.support_tickets set status='open', closed_at=null where id=p_ticket_id returning * into v_ticket;
  return v_ticket;
end; $$;
revoke all on function public.reopen_support_ticket(uuid) from public, anon;
grant execute on function public.reopen_support_ticket(uuid) to authenticated;

create or replace function public.get_my_support_tickets(p_page integer default 1, p_page_size integer default 12)
returns table(id uuid,user_id uuid,subject text,category text,status text,priority text,created_at timestamptz,updated_at timestamptz,closed_at timestamptz,total_count bigint)
language sql stable security definer set search_path=pg_catalog, public as $$
  select t.id,t.user_id,t.subject,t.category,t.status,t.priority,t.created_at,t.updated_at,t.closed_at,
         count(*) over() as total_count
  from public.support_tickets t
  where t.user_id=auth.uid()
  order by t.updated_at desc, t.id desc
  limit greatest(1,least(coalesce(p_page_size,12),50))
  offset greatest(coalesce(p_page,1)-1,0)*greatest(1,least(coalesce(p_page_size,12),50));
$$;
revoke all on function public.get_my_support_tickets(integer,integer) from public, anon;
grant execute on function public.get_my_support_tickets(integer,integer) to authenticated;

create or replace function public.get_my_support_ticket(p_ticket_id uuid)
returns table(id uuid,user_id uuid,subject text,category text,status text,priority text,created_at timestamptz,updated_at timestamptz,closed_at timestamptz)
language sql stable security definer set search_path=pg_catalog, public as $$
  select id,user_id,subject,category,status,priority,created_at,updated_at,closed_at from public.support_tickets where id=p_ticket_id and user_id=auth.uid();
$$;
revoke all on function public.get_my_support_ticket(uuid) from public, anon;
grant execute on function public.get_my_support_ticket(uuid) to authenticated;

create or replace function public.get_my_support_messages(p_ticket_id uuid)
returns table(id uuid,ticket_id uuid,sender_id uuid,message text,created_at timestamptz)
language sql stable security definer set search_path=pg_catalog, public as $$
  select m.id,m.ticket_id,m.sender_id,m.message,m.created_at from public.support_messages m join public.support_tickets t on t.id=m.ticket_id where m.ticket_id=p_ticket_id and t.user_id=auth.uid() order by m.created_at asc,m.id asc;
$$;
revoke all on function public.get_my_support_messages(uuid) from public, anon;
grant execute on function public.get_my_support_messages(uuid) to authenticated;

create or replace function public.get_admin_support_tickets(p_status text default null,p_priority text default null,p_category text default null,p_search text default null,p_page integer default 1,p_page_size integer default 12)
returns table(id uuid,user_id uuid,user_name text,user_email text,subject text,category text,status text,priority text,created_at timestamptz,updated_at timestamptz,closed_at timestamptz,total_count bigint)
language plpgsql stable security definer set search_path=pg_catalog, public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى تذاكر الدعم.' using errcode='42501'; end if;
  return query select t.id,t.user_id,p.full_name,u.email,t.subject,t.category,t.status,t.priority,t.created_at,t.updated_at,t.closed_at,
    count(*) over() from public.support_tickets t join public.profiles p on p.id=t.user_id join auth.users u on u.id=t.user_id
  where (p_status is null or t.status=p_status) and (p_priority is null or t.priority=p_priority) and (p_category is null or t.category=p_category)
    and (p_search is null or btrim(p_search)='' or t.subject ilike '%'||btrim(p_search)||'%' or coalesce(p.full_name,'') ilike '%'||btrim(p_search)||'%')
  order by t.updated_at desc,t.id desc limit greatest(1,least(coalesce(p_page_size,12),50)) offset greatest(coalesce(p_page,1)-1,0)*greatest(1,least(coalesce(p_page_size,12),50));
end; $$;
revoke all on function public.get_admin_support_tickets(text,text,text,text,integer,integer) from public, anon;
grant execute on function public.get_admin_support_tickets(text,text,text,text,integer,integer) to authenticated;

create or replace function public.get_admin_support_ticket(p_ticket_id uuid)
returns table(id uuid,user_id uuid,user_name text,user_email text,subject text,category text,status text,priority text,created_at timestamptz,updated_at timestamptz,closed_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog, public as $$
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى تذكرة الدعم.' using errcode='42501'; end if;
 return query select t.id,t.user_id,p.full_name,u.email,t.subject,t.category,t.status,t.priority,t.created_at,t.updated_at,t.closed_at from public.support_tickets t join public.profiles p on p.id=t.user_id join auth.users u on u.id=t.user_id where t.id=p_ticket_id;
end; $$;
revoke all on function public.get_admin_support_ticket(uuid) from public, anon;
grant execute on function public.get_admin_support_ticket(uuid) to authenticated;

create or replace function public.get_admin_support_messages(p_ticket_id uuid)
returns table(id uuid,ticket_id uuid,sender_id uuid,sender_name text,message text,created_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog, public as $$
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول إلى رسائل الدعم.' using errcode='42501'; end if;
 return query select m.id,m.ticket_id,m.sender_id,coalesce(p.full_name,u.email),m.message,m.created_at from public.support_messages m join auth.users u on u.id=m.sender_id left join public.profiles p on p.id=m.sender_id where m.ticket_id=p_ticket_id order by m.created_at asc,m.id asc;
end; $$;
revoke all on function public.get_admin_support_messages(uuid) from public, anon;
grant execute on function public.get_admin_support_messages(uuid) to authenticated;

create or replace function public.admin_reply_support_ticket(p_ticket_id uuid,p_message text)
returns public.support_messages
language plpgsql security definer set search_path=pg_catalog, public as $$
declare v_ticket public.support_tickets; v_message public.support_messages;
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية إدارة تذاكر الدعم.' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_message,''))) not between 1 and 5000 then raise exception 'رسالة الدعم يجب أن تكون بين 1 و5000 محرف.'; end if;
 select * into v_ticket from public.support_tickets where id=p_ticket_id;
 if not found then raise exception 'التذكرة غير موجودة.'; end if;
 if v_ticket.status='closed' then raise exception 'لا يمكن الرد على تذكرة مغلقة.'; end if;
 insert into public.support_messages(ticket_id,sender_id,message) values(p_ticket_id,auth.uid(),btrim(p_message)) returning * into v_message;
 insert into public.notifications(user_id,title,message,type,related_ticket_id) values(v_ticket.user_id,'لديك رد جديد من الدعم','تم الرد على تذكرة الدعم: '||v_ticket.subject,'support_reply',v_ticket.id);
 return v_message;
end; $$;
revoke all on function public.admin_reply_support_ticket(uuid,text) from public, anon;
grant execute on function public.admin_reply_support_ticket(uuid,text) to authenticated;

create or replace function public.admin_update_support_ticket(p_ticket_id uuid,p_status text,p_priority text)
returns public.support_tickets
language plpgsql security definer set search_path=pg_catalog, public as $$
declare v_ticket public.support_tickets; v_changed boolean;
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية إدارة تذاكر الدعم.' using errcode='42501'; end if;
 if p_status not in ('open','in_progress','waiting_user','resolved','closed') then raise exception 'حالة التذكرة غير صالحة.'; end if;
 if p_priority not in ('low','normal','high','urgent') then raise exception 'أولوية التذكرة غير صالحة.'; end if;
 select * into v_ticket from public.support_tickets where id=p_ticket_id;
 if not found then raise exception 'التذكرة غير موجودة.'; end if;
 v_changed := v_ticket.status is distinct from p_status;
 update public.support_tickets set status=p_status,priority=p_priority,closed_at=case when p_status='closed' then coalesce(closed_at,now()) else null end where id=p_ticket_id returning * into v_ticket;
 if v_changed then insert into public.notifications(user_id,title,message,type,related_ticket_id) values(v_ticket.user_id,'تم تحديث حالة طلب الدعم','تم تحديث حالة تذكرة الدعم "'||v_ticket.subject||'" إلى: '||case p_status when 'open' then 'مفتوحة' when 'in_progress' then 'قيد المعالجة' when 'waiting_user' then 'بانتظار ردك' when 'resolved' then 'تم الحل' else 'مغلقة' end,'support_status_changed',v_ticket.id); end if;
 return v_ticket;
end; $$;
revoke all on function public.admin_update_support_ticket(uuid,text,text) from public, anon;
grant execute on function public.admin_update_support_ticket(uuid,text,text) to authenticated;

create or replace function public.get_admin_support_summary()
returns table(open_tickets bigint,in_progress_tickets bigint,waiting_user_tickets bigint,urgent_tickets bigint)
language plpgsql stable security definer set search_path=pg_catalog, public as $$
begin
 if not public.is_admin(auth.uid()) then raise exception 'لا تملك صلاحية الوصول.' using errcode='42501'; end if;
 return query select count(*) filter(where status='open'),count(*) filter(where status='in_progress'),count(*) filter(where status='waiting_user'),count(*) filter(where priority='urgent' and status not in ('closed','resolved')) from public.support_tickets;
end; $$;
revoke all on function public.get_admin_support_summary() from public, anon;
grant execute on function public.get_admin_support_summary() to authenticated;

-- Extend the existing notification system without replacing it.
alter table public.notifications add column if not exists related_ticket_id uuid null references public.support_tickets(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('new_offer','offer_selected','request_started','request_completed','request_cancelled','matching_request','support_reply','support_status_changed'));
create index if not exists notifications_ticket_id_idx on public.notifications(related_ticket_id);

create or replace function public.support_message_touch_ticket()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin update public.support_tickets set updated_at=now() where id=new.ticket_id; return new; end; $$;
revoke all on function public.support_message_touch_ticket() from public, anon, authenticated;
drop trigger if exists support_messages_touch_ticket on public.support_messages;
create trigger support_messages_touch_ticket after insert on public.support_messages for each row execute function public.support_message_touch_ticket();

-- ===== END ORIGINAL: 20260920140000_support_system.sql =====


-- ===== BEGIN ORIGINAL: 20260920150000_final_audit_fixes.sql =====
-- MATLOOB Step 30: final audit fixes.
-- This migration only repairs a schema mismatch discovered during the full audit.
-- Historical migrations are intentionally left unchanged.

-- Step 20/28/29/TypeScript code all depend on supplier_profiles.verified,
-- but the original Step 9 table did not declare the column. Add it safely for
-- existing deployments; existing supplier records become unverified by default.
alter table public.supplier_profiles
  add column if not exists verified boolean not null default false;

-- Normal authenticated clients must never be able to change verification state.
revoke update (verified) on public.supplier_profiles from authenticated;

-- ===== END ORIGINAL: 20260920150000_final_audit_fixes.sql =====


-- ===== BEGIN ORIGINAL: 20260920160000_fix_request_visibility_rls_recursion.sql =====
-- Migration 25
-- Fix request visibility RLS recursion.
-- The visibility helper must not query public.requests while public.requests
-- RLS is evaluating a request row.

create or replace function public.can_supplier_view_request(
  p_request_id uuid,
  p_status text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_role text;
  v_is_pro boolean;
  v_free_enabled boolean;
  v_pro_enabled boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return false;
  end if;

  if p_request_id is null or p_status is distinct from 'open' then
    return false;
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id;

  if v_role <> 'supplier' then
    return false;
  end if;

  select
    p.free_visibility_enabled,
    p.pro_visibility_enabled
  into v_free_enabled, v_pro_enabled
  from public.request_visibility_policy p
  where p.id = 1;

  if not coalesce(v_free_enabled, false) and not coalesce(v_pro_enabled, false) then
    return false;
  end if;

  v_is_pro := public.has_active_pro_subscription(v_user_id);

  if v_is_pro then
    return coalesce(v_pro_enabled, false);
  end if;

  return coalesce(v_free_enabled, false);
end;
$$;

revoke all on function public.can_supplier_view_request(uuid, text) from public, anon;
grant execute on function public.can_supplier_view_request(uuid, text) to authenticated;

-- search_requests receives the already-selected request status from its row.
create or replace function public.search_requests(
  p_search text default null,
  p_category_id uuid default null,
  p_city_id uuid default null,
  p_status text default null,
  p_min_quantity numeric default null,
  p_delivery_before date default null,
  p_ascending boolean default false,
  p_page integer default 1,
  p_page_size integer default 12
)
returns table (
  id uuid,
  requester_id uuid,
  title text,
  category_id uuid,
  description text,
  quantity numeric,
  unit text,
  city_id uuid,
  delivery_area text,
  deadline date,
  budget numeric,
  preferred_contact text,
  phone text,
  status text,
  selected_offer_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then
    return;
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id;

  return query
  select
    r.id,
    r.requester_id,
    r.title,
    r.category_id,
    r.description,
    r.quantity,
    r.unit,
    r.city_id,
    r.delivery_area,
    r.deadline,
    r.budget,
    r.preferred_contact,
    r.phone,
    r.status,
    r.selected_offer_id,
    r.created_at,
    r.updated_at,
    count(*) over() as total_count
  from public.requests r
  where
    (
      (
        v_role = 'supplier'
        and public.can_supplier_view_request(r.id, r.status)
      )
      or
      (
        v_role <> 'supplier'
        and (r.requester_id = v_user_id or r.status = 'open')
        and (p_status is null or r.status = p_status)
      )
    )
    and (
      (v_role = 'supplier' and (p_status is null or p_status = 'open'))
      or (v_role <> 'supplier')
    )
    and (p_search is null or btrim(p_search) = '' or position(lower(btrim(p_search)) in lower(coalesce(r.title, ''))) > 0 or position(lower(btrim(p_search)) in lower(coalesce(r.description, ''))) > 0)
    and (p_category_id is null or r.category_id = p_category_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_min_quantity is null or (r.quantity is not null and r.quantity >= p_min_quantity))
    and (p_delivery_before is null or (r.deadline is not null and r.deadline <= p_delivery_before))
  order by
    case when p_ascending then r.created_at end asc,
    case when not p_ascending then r.created_at end desc,
    r.id desc
  offset greatest(p_page - 1, 0) * least(greatest(p_page_size, 1), 100)
  limit least(greatest(p_page_size, 1), 100);
end;
$$;

revoke all on function public.search_requests(text, uuid, uuid, text, numeric, date, boolean, integer, integer) from public, anon;
grant execute on function public.search_requests(text, uuid, uuid, text, numeric, date, boolean, integer, integer) to authenticated;

-- Pass the row status into the helper so requests RLS never causes the helper
-- to read public.requests again.
drop policy if exists "requests_select_open_authenticated" on public.requests;
create policy "requests_select_open_authenticated"
on public.requests
for select
to authenticated
using (
  requester_id = auth.uid()
  or (
    status = 'open'
    and public.can_supplier_view_request(id, status)
  )
  or exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = selected_offer_id
      and sp.user_id = auth.uid()
  )
);

-- Update the existing matching RPC to use the status already read for the
-- request, avoiding another request-table lookup from the visibility helper.
create or replace function public.get_matching_suppliers_for_request(p_request_id uuid)
returns table (
  supplier_id uuid,
  company_name text,
  business_type text,
  city_id uuid,
  verified boolean,
  is_pro boolean,
  match_score integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_requester_id uuid;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id;

  if v_role is null then
    raise exception 'ملف المستخدم غير موجود.';
  end if;

  select r.requester_id, r.status
    into v_requester_id, v_status
  from public.requests r
  where r.id = p_request_id;

  if not found then
    raise exception 'الطلب غير موجود.';
  end if;

  if v_status <> 'open' then
    raise exception 'المطابقة متاحة للطلبات المفتوحة فقط.';
  end if;

  if v_role = 'requester' then
    if v_requester_id <> v_user_id then
      raise exception 'لا تملك صلاحية الوصول إلى مطابقة هذا الطلب.';
    end if;
  elsif v_role = 'supplier' then
    if not public.can_supplier_view_request(p_request_id, v_status) then
      raise exception 'هذا الطلب غير متاح لك حاليًا.';
    end if;
  elsif v_role = 'admin' then
    if not public.is_admin(v_user_id) then
      raise exception 'لا تملك صلاحية الوصول إلى المطابقة.';
    end if;
  else
    if not public.is_admin(v_user_id) then
      raise exception 'لا تملك صلاحية الوصول إلى المطابقة.';
    end if;
  end if;

  return query
  with request_context as (
    select r.category_id, r.city_id
    from public.requests r
    where r.id = p_request_id
  ),
  category_matches as (
    select distinct sc.supplier_id
    from public.supplier_categories sc
    join request_context rc on rc.category_id = sc.category_id
  )
  select
    sp.user_id as supplier_id,
    sp.company_name,
    sp.business_type,
    sp.city_id,
    sp.verified,
    public.is_active_pro_supplier_for_matching(sp.user_id) as is_pro,
    (
      70
      + case when sp.city_id is not null and rc.city_id is not null and sp.city_id = rc.city_id then 20 else 0 end
      + case when coalesce(sp.verified, false) then 5 else 0 end
      + case when public.is_active_pro_supplier_for_matching(sp.user_id) then 5 else 0 end
    )::integer as match_score
  from category_matches cm
  join public.supplier_profiles sp on sp.id = cm.supplier_id
  cross join request_context rc
  join public.profiles pr on pr.id = sp.user_id and pr.role = 'supplier'
  order by
    match_score desc,
    sp.created_at desc,
    sp.user_id asc;
end;
$$;

revoke all on function public.get_matching_suppliers_for_request(uuid) from public, anon;
grant execute on function public.get_matching_suppliers_for_request(uuid) to authenticated;

-- save_request uses the request status already required by the RPC.
create or replace function public.save_request(p_request_id uuid)
returns public.saved_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_supplier_id uuid;
  v_request public.saved_requests;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select sp.id
    into v_supplier_id
  from public.supplier_profiles sp
  join public.profiles p on p.id = sp.user_id
  where sp.user_id = v_user_id
    and p.role = 'supplier'
  for update of sp;

  if v_supplier_id is null then
    raise exception 'هذه العملية متاحة للموردين فقط.';
  end if;

  if not exists (
    select 1
    from public.requests r
    where r.id = p_request_id
      and r.status = 'open'
  ) then
    raise exception 'لا يمكن حفظ هذا الطلب لأنه غير مفتوح أو غير موجود.';
  end if;

  if not public.can_supplier_view_request(p_request_id, 'open') then
    raise exception 'هذا الطلب غير متاح لك حاليًا.';
  end if;

  insert into public.saved_requests (supplier_id, request_id)
  values (v_supplier_id, p_request_id)
  on conflict (supplier_id, request_id) do nothing
  returning * into v_request;

  if v_request.id is null then
    select sr.*
      into v_request
    from public.saved_requests sr
    where sr.supplier_id = v_supplier_id
      and sr.request_id = p_request_id;
  end if;

  return v_request;
end;
$$;

revoke all on function public.save_request(uuid) from public, anon;
grant execute on function public.save_request(uuid) to authenticated;

-- ===== END ORIGINAL: 20260920160000_fix_request_visibility_rls_recursion.sql =====


-- ===== BEGIN ORIGINAL: 20260920170000_fix_matching_notification_rls_recursion.sql =====
-- Migration 26
-- Fix matching-notification RLS recursion.
-- The trigger runs without an authenticated caller, so its visibility helper
-- receives the request status directly instead of querying public.requests.

drop function if exists public.can_supplier_view_request_for_matching(uuid, uuid);

create or replace function public.can_supplier_view_request_for_matching(
  p_request_id uuid,
  p_supplier_id uuid,
  p_request_status text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_supplier_role text;
  v_free_enabled boolean;
  v_pro_enabled boolean;
  v_is_pro boolean;
begin
  if p_request_id is null or p_supplier_id is null then
    return false;
  end if;

  if p_request_status is distinct from 'open' then
    return false;
  end if;

  select p.role
    into v_supplier_role
  from public.profiles p
  where p.id = p_supplier_id;

  if v_supplier_role is distinct from 'supplier' then
    return false;
  end if;

  select
    p.free_visibility_enabled,
    p.pro_visibility_enabled
    into v_free_enabled, v_pro_enabled
  from public.request_visibility_policy p
  where p.id = 1;

  if not coalesce(v_free_enabled, false) and not coalesce(v_pro_enabled, false) then
    return false;
  end if;

  v_is_pro := public.is_active_pro_supplier_for_matching(p_supplier_id);

  if v_is_pro then
    return coalesce(v_pro_enabled, false);
  end if;

  return coalesce(v_free_enabled, false);
end;
$$;

revoke all on function public.can_supplier_view_request_for_matching(uuid, uuid, text) from public, anon, authenticated;

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
  if new.status is distinct from 'open' then
    return new;
  end if;

  if new.category_id is null then
    return new;
  end if;

  select c.name
    into v_city_name
  from public.cities c
  where c.id = new.city_id;

  for v_supplier_id in
    select distinct sc.supplier_id
    from public.supplier_categories sc
    join public.supplier_profiles sp on sp.user_id = sc.supplier_id
    join public.profiles pr on pr.id = sp.user_id
    where sc.category_id = new.category_id
      and pr.role = 'supplier'
      and sc.supplier_id <> new.requester_id
      and public.can_supplier_view_request_for_matching(new.id, sc.supplier_id, new.status)
  loop
    perform public.create_system_notification(
      v_supplier_id,
      'طلب جديد يطابق تخصصك',
      'طلب جديد: ' || new.title || case
        when v_city_name is not null then ' — المدينة: ' || v_city_name
        else ''
      end,
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
for each row
execute function public.notify_matching_suppliers_for_new_request();

-- ===== END ORIGINAL: 20260920170000_fix_matching_notification_rls_recursion.sql =====


-- ===== BEGIN ORIGINAL: 20260920180000_fix_requests_offers_rls_recursion.sql =====
-- Migration 27
-- Fix requests <-> offers RLS recursion
-- Creates a private SECURITY DEFINER helper so requests RLS
-- can verify the selected offer owner without querying requests again.

create schema if not exists private;

create or replace function private.is_selected_offer_owner(
  p_offer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.offers as o
    join public.supplier_profiles as sp
      on sp.id = o.supplier_id
    where o.id = p_offer_id
      and sp.user_id = (select auth.uid())
  );
$$;

revoke all
on schema private
from public;

grant usage
on schema private
to authenticated;

revoke all
on function private.is_selected_offer_owner(uuid)
from public;

grant execute
on function private.is_selected_offer_owner(uuid)
to authenticated;

drop policy if exists "requests_select_open_authenticated"
on public.requests;

create policy "requests_select_open_authenticated"
on public.requests
for select
to authenticated
using (
  requester_id = auth.uid()
  or (
    status = 'open'
    and public.can_supplier_view_request(id, status)
  )
  or private.is_selected_offer_owner(selected_offer_id)
);

-- ===== END ORIGINAL: 20260920180000_fix_requests_offers_rls_recursion.sql =====
