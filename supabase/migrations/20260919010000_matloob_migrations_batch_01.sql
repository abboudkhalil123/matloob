-- MATLOOB merged migration batch 1/3
-- Files preserved in original timestamp order:


-- ===== BEGIN ORIGINAL: 20260919190000_create_profiles.sql =====
-- MATLOOB Step 7: profiles table
-- Apply this migration to the real Supabase project. It is not applied automatically by the app.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'requester',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('requester', 'supplier'))
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_name text;
  metadata_role text;
begin
  metadata_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  metadata_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'مورد' then 'supplier'
    when new.raw_user_meta_data ->> 'account_type' = 'supplier' then 'supplier'
    when new.raw_user_meta_data ->> 'account_type' = 'طالب خدمة' then 'requester'
    when new.raw_user_meta_data ->> 'account_type' = 'requester' then 'requester'
    else 'requester'
  end;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(metadata_name, nullif(trim(coalesce(new.email, '')), '')),
    metadata_role
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    -- Profile creation must not prevent Auth from creating the user.
    raise warning 'MATLOOB profile creation failed for auth user %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public;
grant execute on function public.handle_new_user_profile() to service_role;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

alter table public.profiles enable row level security;

-- Users can read only their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- Users can update only their own profile.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- No INSERT or DELETE policy is intentionally created for authenticated users.
-- Profile creation is handled by the Auth trigger; deletion is not exposed in this step.

-- ===== END ORIGINAL: 20260919190000_create_profiles.sql =====


-- ===== BEGIN ORIGINAL: 20260919193000_create_request_data.sql =====
-- MATLOOB Step 8: requests + reference data
-- Apply this migration to the real Supabase project after the Step 7 profiles migration.
-- This migration creates only requests, categories, and cities.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.categories (name, slug) values
  ('تصنيع', 'manufacturing'),
  ('ألبسة', 'clothing'),
  ('طباعة', 'printing'),
  ('تطريز', 'embroidery'),
  ('خياطة', 'sewing'),
  ('مواد أولية', 'raw-materials'),
  ('أثاث', 'furniture'),
  ('معادن', 'metals'),
  ('CNC', 'cnc'),
  ('صيانة', 'maintenance'),
  ('نقل', 'transport'),
  ('خدمات', 'services'),
  ('تصميم', 'design'),
  ('مقاولات', 'contracting'),
  ('إلكترونيات', 'electronics'),
  ('أخرى', 'other')
on conflict (name) do nothing;

insert into public.cities (name) values
  ('حلب'),
  ('دمشق'),
  ('ريف دمشق'),
  ('حمص'),
  ('حماة'),
  ('اللاذقية'),
  ('طرطوس'),
  ('إدلب'),
  ('الرقة'),
  ('دير الزور'),
  ('الحسكة'),
  ('درعا'),
  ('السويداء'),
  ('القنيطرة')
on conflict (name) do nothing;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  description text not null,
  quantity numeric,
  unit text,
  city_id uuid not null references public.cities(id) on delete restrict,
  delivery_area text,
  deadline date,
  budget numeric,
  preferred_contact text,
  phone text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requests_status_check check (status in ('open', 'closed', 'supplier_selected', 'in_progress', 'completed', 'cancelled')),
  constraint requests_quantity_nonnegative check (quantity is null or quantity >= 0),
  constraint requests_budget_nonnegative check (budget is null or budget >= 0)
);

create or replace function public.set_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists requests_set_updated_at on public.requests;
create trigger requests_set_updated_at
before update on public.requests
for each row
execute function public.set_requests_updated_at();

alter table public.categories enable row level security;
alter table public.cities enable row level security;
alter table public.requests enable row level security;

drop policy if exists "categories_select_authenticated" on public.categories;
create policy "categories_select_authenticated"
on public.categories
for select
to authenticated
using (true);

drop policy if exists "cities_select_authenticated" on public.cities;
create policy "cities_select_authenticated"
on public.cities
for select
to authenticated
using (true);

drop policy if exists "requests_select_open_authenticated" on public.requests;
create policy "requests_select_open_authenticated"
on public.requests
for select
to authenticated
using (status = 'open' or requester_id = auth.uid());

drop policy if exists "requests_insert_own" on public.requests;
create policy "requests_insert_own"
on public.requests
for insert
to authenticated
with check (requester_id = auth.uid());

drop policy if exists "requests_update_own" on public.requests;
create policy "requests_update_own"
on public.requests
for update
to authenticated
using (requester_id = auth.uid())
with check (requester_id = auth.uid());

drop policy if exists "requests_delete_own" on public.requests;
create policy "requests_delete_own"
on public.requests
for delete
to authenticated
using (requester_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies are created for authenticated users on categories/cities.

-- ===== END ORIGINAL: 20260919193000_create_request_data.sql =====


-- ===== BEGIN ORIGINAL: 20260919200000_create_supplier_profiles.sql =====
-- MATLOOB Step 9: supplier profiles, categories, and working hours
-- Apply after the Step 7 profiles and Step 8 reference-data migrations.
-- This migration does not create users or supplier records.

create table if not exists public.supplier_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  company_name text,
  business_type text,
  description text,
  city_id uuid references public.cities(id) on delete set null,
  location_text text,
  years_experience integer,
  phone text,
  contact_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_profiles_years_experience_check check (years_experience is null or years_experience >= 0)
);

create table if not exists public.supplier_categories (
  supplier_id uuid not null references public.supplier_profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (supplier_id, category_id)
);

create table if not exists public.supplier_working_hours (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_profiles(id) on delete cascade,
  day_of_week integer not null,
  is_open boolean not null default true,
  open_time time,
  close_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_working_hours_day_check check (day_of_week between 0 and 6),
  constraint supplier_working_hours_unique_day unique (supplier_id, day_of_week)
);

create or replace function public.set_supplier_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists supplier_profiles_set_updated_at on public.supplier_profiles;
create trigger supplier_profiles_set_updated_at
before update on public.supplier_profiles
for each row
execute function public.set_supplier_profiles_updated_at();

create or replace function public.set_supplier_working_hours_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists supplier_working_hours_set_updated_at on public.supplier_working_hours;
create trigger supplier_working_hours_set_updated_at
before update on public.supplier_working_hours
for each row
execute function public.set_supplier_working_hours_updated_at();

alter table public.supplier_profiles enable row level security;
alter table public.supplier_categories enable row level security;
alter table public.supplier_working_hours enable row level security;

-- Authenticated users may read supplier directory data. Anonymous users have no access.
drop policy if exists "supplier_profiles_select_authenticated" on public.supplier_profiles;
create policy "supplier_profiles_select_authenticated"
on public.supplier_profiles
for select
to authenticated
using (true);

-- Only a supplier account may create its own supplier profile.
drop policy if exists "supplier_profiles_insert_own_supplier" on public.supplier_profiles;
create policy "supplier_profiles_insert_own_supplier"
on public.supplier_profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'supplier'
  )
);

-- Only the owner may update/delete their supplier profile.
drop policy if exists "supplier_profiles_update_own" on public.supplier_profiles;
create policy "supplier_profiles_update_own"
on public.supplier_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'supplier'
  )
);

drop policy if exists "supplier_profiles_delete_own" on public.supplier_profiles;
create policy "supplier_profiles_delete_own"
on public.supplier_profiles
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'supplier'
  )
);

-- Authenticated users may read supplier categories for the directory.
drop policy if exists "supplier_categories_select_authenticated" on public.supplier_categories;
create policy "supplier_categories_select_authenticated"
on public.supplier_categories
for select
to authenticated
using (true);

-- Owners may add/delete only their own supplier-category links.
drop policy if exists "supplier_categories_insert_own" on public.supplier_categories;
create policy "supplier_categories_insert_own"
on public.supplier_categories
for insert
to authenticated
with check (
  exists (
    select 1
    from public.supplier_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.id = supplier_id
      and sp.user_id = auth.uid()
      and p.role = 'supplier'
  )
);

drop policy if exists "supplier_categories_delete_own" on public.supplier_categories;
create policy "supplier_categories_delete_own"
on public.supplier_categories
for delete
to authenticated
using (
  exists (
    select 1
    from public.supplier_profiles sp
    where sp.id = supplier_id
      and sp.user_id = auth.uid()
  )
);

-- Authenticated users may read working hours for supplier directory pages.
drop policy if exists "supplier_working_hours_select_authenticated" on public.supplier_working_hours;
create policy "supplier_working_hours_select_authenticated"
on public.supplier_working_hours
for select
to authenticated
using (true);

-- Owners may manage only their own working hours.
drop policy if exists "supplier_working_hours_insert_own" on public.supplier_working_hours;
create policy "supplier_working_hours_insert_own"
on public.supplier_working_hours
for insert
to authenticated
with check (
  exists (
    select 1
    from public.supplier_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.id = supplier_id
      and sp.user_id = auth.uid()
      and p.role = 'supplier'
  )
);

drop policy if exists "supplier_working_hours_update_own" on public.supplier_working_hours;
create policy "supplier_working_hours_update_own"
on public.supplier_working_hours
for update
to authenticated
using (
  exists (
    select 1
    from public.supplier_profiles sp
    where sp.id = supplier_id
      and sp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.supplier_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.id = supplier_id
      and sp.user_id = auth.uid()
      and p.role = 'supplier'
  )
);

drop policy if exists "supplier_working_hours_delete_own" on public.supplier_working_hours;
create policy "supplier_working_hours_delete_own"
on public.supplier_working_hours
for delete
to authenticated
using (
  exists (
    select 1
    from public.supplier_profiles sp
    where sp.id = supplier_id
      and sp.user_id = auth.uid()
  )
);

-- No policies are granted to anon and no admin privileges are introduced here.

-- ===== END ORIGINAL: 20260919200000_create_supplier_profiles.sql =====


-- ===== BEGIN ORIGINAL: 20260919210000_create_offers.sql =====
-- MATLOOB Step 10: offers
-- Apply after Step 8 requests and Step 9 supplier profile migrations.
-- This migration does not create users, requests, suppliers, or offer records.

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  supplier_id uuid not null references public.supplier_profiles(id) on delete cascade,
  price numeric not null,
  currency text not null default 'SYP',
  duration_value integer,
  duration_unit text,
  details text not null,
  payment_terms text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_duration_unit_check check (duration_unit is null or duration_unit in ('hours', 'days', 'weeks', 'months')),
  constraint offers_duration_value_check check (duration_value is null or duration_value > 0),
  constraint offers_price_check check (price >= 0),
  constraint offers_unique_request_supplier unique (request_id, supplier_id)
);

create or replace function public.set_offers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at
before update on public.offers
for each row
execute function public.set_offers_updated_at();

create or replace function public.prevent_offer_relationship_change()
returns trigger
language plpgsql
as $$
begin
  if new.request_id <> old.request_id or new.supplier_id <> old.supplier_id then
    raise exception 'Offer request_id and supplier_id cannot be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists offers_prevent_relationship_change on public.offers;
create trigger offers_prevent_relationship_change
before update on public.offers
for each row
execute function public.prevent_offer_relationship_change();

alter table public.offers enable row level security;

-- A supplier can see only their own offers.
drop policy if exists "offers_select_own_supplier" on public.offers;
create policy "offers_select_own_supplier"
on public.offers
for select
to authenticated
using (
  exists (
    select 1
    from public.supplier_profiles sp
    where sp.id = offers.supplier_id
      and sp.user_id = auth.uid()
  )
);

-- A requester can see offers only for requests they own.
drop policy if exists "offers_select_request_owner" on public.offers;
create policy "offers_select_request_owner"
on public.offers
for select
to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.id = offers.request_id
      and r.requester_id = auth.uid()
  )
);

-- Only a supplier account can create an offer using its own supplier profile,
-- and only while the target request is open and belongs to a different user.
drop policy if exists "offers_insert_own_supplier" on public.offers;
create policy "offers_insert_own_supplier"
on public.offers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.supplier_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.id = offers.supplier_id
      and sp.user_id = auth.uid()
      and p.role = 'supplier'
  )
  and exists (
    select 1
    from public.requests r
    where r.id = offers.request_id
      and r.status = 'open'
      and r.requester_id <> auth.uid()
  )
);

-- Suppliers can update only their own offers. Request and supplier ownership
-- cannot be changed through the update policy.
drop policy if exists "offers_update_own_supplier" on public.offers;
create policy "offers_update_own_supplier"
on public.offers
for update
to authenticated
using (
  exists (
    select 1
    from public.supplier_profiles sp
    where sp.id = offers.supplier_id
      and sp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.supplier_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.id = offers.supplier_id
      and sp.user_id = auth.uid()
      and p.role = 'supplier'
  )
  and exists (
    select 1
    from public.requests r
    where r.id = offers.request_id
      and r.status = 'open'
      and r.requester_id <> auth.uid()
  )
);

-- Only the supplier who owns the offer can delete it.
drop policy if exists "offers_delete_own_supplier" on public.offers;
create policy "offers_delete_own_supplier"
on public.offers
for delete
to authenticated
using (
  exists (
    select 1
    from public.supplier_profiles sp
    where sp.id = offers.supplier_id
      and sp.user_id = auth.uid()
  )
);

-- No anon policies and no requester update/delete policies are created.

-- ===== END ORIGINAL: 20260919210000_create_offers.sql =====


-- ===== BEGIN ORIGINAL: 20260919220000_add_selected_offer_to_requests.sql =====
-- MATLOOB Step 11: selected offer / supplier selection
-- Apply after Step 10 offers migration.
-- No notifications, payments, ratings, PRO, or other later-stage features are created here.

alter table public.requests
  add column if not exists selected_offer_id uuid null;

alter table public.requests
  drop constraint if exists requests_selected_offer_id_fkey;

alter table public.requests
  add constraint requests_selected_offer_id_fkey
  foreign key (selected_offer_id)
  references public.offers(id)
  on delete set null;

-- Keep selection-related changes inside the dedicated atomic RPC.
create or replace function public.prevent_direct_offer_selection_change()
returns trigger
language plpgsql
as $$
begin
  if (new.selected_offer_id is distinct from old.selected_offer_id
      or new.status is distinct from old.status and new.status = 'supplier_selected')
     and current_setting('matloob.select_offer_operation', true) is distinct from 'true' then
    raise exception 'Offer selection must use select_offer_for_request.';
  end if;
  return new;
end;
$$;

drop trigger if exists requests_prevent_direct_offer_selection_change on public.requests;
create trigger requests_prevent_direct_offer_selection_change
before update on public.requests
for each row
execute function public.prevent_direct_offer_selection_change();

create or replace function public.select_offer_for_request(p_request_id uuid, p_offer_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.requests;
  v_offer public.offers;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'الطلب غير موجود.';
  end if;

  if v_request.requester_id <> v_user_id then
    raise exception 'لا يمكنك اختيار عرض لطلب لا تملكه.';
  end if;

  if v_request.status <> 'open' then
    raise exception 'لا يمكن اختيار عرض بعد إغلاق الطلب أو اختيار مورد له.';
  end if;

  select * into v_offer
  from public.offers
  where id = p_offer_id;

  if not found then
    raise exception 'العرض غير موجود.';
  end if;

  if v_offer.request_id <> p_request_id then
    raise exception 'العرض لا ينتمي إلى هذا الطلب.';
  end if;

  perform set_config('matloob.select_offer_operation', 'true', true);

  update public.requests
  set selected_offer_id = p_offer_id,
      status = 'supplier_selected',
      updated_at = now()
  where id = p_request_id;

  select * into v_request
  from public.requests
  where id = p_request_id;

  return v_request;
end;
$$;

revoke all on function public.select_offer_for_request(uuid, uuid) from public;
grant execute on function public.select_offer_for_request(uuid, uuid) to authenticated;

-- ===== END ORIGINAL: 20260919220000_add_selected_offer_to_requests.sql =====


-- ===== BEGIN ORIGINAL: 20260919223000_harden_selected_offer_security.sql =====
-- MATLOOB Step 11 security hardening.
-- Keep the original Step 11 migration unchanged; this migration removes the
-- client-controlled GUC from the authorization boundary.

-- Authenticated users may update normal request fields. Workflow state and
-- selected_offer_id are intentionally excluded from direct client UPDATEs.
revoke update on table public.requests from authenticated;
grant update (
  title,
  category_id,
  description,
  quantity,
  unit,
  city_id,
  delivery_area,
  deadline,
  budget,
  preferred_contact,
  phone
) on table public.requests to authenticated;

-- New requests are always created in the database default state. Clients do
-- not receive INSERT privileges for workflow state or selected_offer_id.
revoke insert (status, selected_offer_id) on table public.requests from authenticated;

-- Defense in depth: even a privileged table update must preserve the
-- selection invariants. Authorization is provided by column privileges/RLS;
-- this trigger validates the resulting state and does not trust a client GUC.
create or replace function public.prevent_invalid_offer_selection_state()
returns trigger
language plpgsql
as $$
declare
  v_offer_request_id uuid;
begin
  if new.selected_offer_id is distinct from old.selected_offer_id
     or (new.status is distinct from old.status and new.status = 'supplier_selected') then

    if old.status <> 'open' then
      raise exception 'لا يمكن اختيار عرض بعد إغلاق الطلب أو اختيار مورد له.';
    end if;

    if new.status <> 'supplier_selected' or new.selected_offer_id is null then
      raise exception 'اختيار العرض يجب أن يتم عبر عملية اختيار صحيحة.';
    end if;

    select request_id
      into v_offer_request_id
    from public.offers
    where id = new.selected_offer_id;

    if v_offer_request_id is null then
      raise exception 'العرض غير موجود.';
    end if;

    if v_offer_request_id <> new.id then
      raise exception 'العرض لا ينتمي إلى هذا الطلب.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists requests_prevent_direct_offer_selection_change on public.requests;
create trigger requests_prevent_direct_offer_selection_change
before update on public.requests
for each row
execute function public.prevent_invalid_offer_selection_state();

-- Remove the superseded trigger function that used the client-controlled GUC.
drop function if exists public.prevent_direct_offer_selection_change();

-- The RPC remains the only client-facing operation that can actually set
-- selected_offer_id, because authenticated lacks UPDATE privilege on that
-- column. Its SECURITY DEFINER execution can still perform the atomic update.

-- Recreate the RPC without the client-controlled GUC. The function's
-- SECURITY DEFINER privilege is sufficient for its atomic table update;
-- ownership is not communicated through a session variable.
create or replace function public.select_offer_for_request(p_request_id uuid, p_offer_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.requests;
  v_offer public.offers;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'الطلب غير موجود.';
  end if;

  if v_request.requester_id <> v_user_id then
    raise exception 'لا يمكنك اختيار عرض لطلب لا تملكه.';
  end if;

  if v_request.status <> 'open' then
    raise exception 'لا يمكن اختيار عرض بعد إغلاق الطلب أو اختيار مورد له.';
  end if;

  select * into v_offer
  from public.offers
  where id = p_offer_id;

  if not found then
    raise exception 'العرض غير موجود.';
  end if;

  if v_offer.request_id <> p_request_id then
    raise exception 'العرض لا ينتمي إلى هذا الطلب.';
  end if;

  update public.requests
  set selected_offer_id = p_offer_id,
      status = 'supplier_selected',
      updated_at = now()
  where id = p_request_id;

  select * into v_request
  from public.requests
  where id = p_request_id;

  return v_request;
end;
$$;

revoke all on function public.select_offer_for_request(uuid, uuid) from public;
grant execute on function public.select_offer_for_request(uuid, uuid) to authenticated;

-- ===== END ORIGINAL: 20260919223000_harden_selected_offer_security.sql =====


-- ===== BEGIN ORIGINAL: 20260919230000_request_workflow_transitions.sql =====
-- MATLOOB Step 12: secure request lifecycle transitions.
-- Keep previous migrations unchanged. Workflow changes are exposed only through
-- dedicated SECURITY DEFINER RPCs; authenticated users do not receive direct
-- UPDATE privilege on requests.status or requests.selected_offer_id.

-- Defense in depth: preserve the protected columns from ordinary client writes.
revoke update (status, selected_offer_id) on table public.requests from authenticated;

-- A selected supplier must be able to read the request it is responsible for
-- after selection; this does not grant any write capability.
drop policy if exists "requests_select_open_authenticated" on public.requests;
create policy "requests_select_open_authenticated"
on public.requests
for select
to authenticated
using (
  status = 'open'
  or requester_id = auth.uid()
  or exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = selected_offer_id
      and sp.user_id = auth.uid()
  )
);

-- Validate the selected offer and supplier relationship whenever the protected
-- selection state is changed. This trigger does not trust any client-controlled
-- GUC or session variable.
create or replace function public.validate_request_selection_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_supplier_user_id uuid;
begin
  if new.selected_offer_id is distinct from old.selected_offer_id then
    if new.selected_offer_id is null then
      raise exception 'لا يمكن إزالة العرض المختار بهذه العملية.';
    end if;

    select sp.user_id
      into v_supplier_user_id
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    join public.profiles p on p.id = sp.user_id
    where o.id = new.selected_offer_id
      and o.request_id = new.id
      and p.role = 'supplier';

    if v_supplier_user_id is null then
      raise exception 'العرض المختار أو ملف المورد غير صالح.';
    end if;
  end if;

  if new.status = 'supplier_selected' and old.status is distinct from new.status then
    if new.selected_offer_id is null then
      raise exception 'لا يمكن اعتماد الطلب دون عرض مختار.';
    end if;

    if old.status <> 'open' then
      raise exception 'لا يمكن اختيار مورد بعد تغيير حالة الطلب.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists requests_validate_selection_state on public.requests;
create trigger requests_validate_selection_state
before update on public.requests
for each row
execute function public.validate_request_selection_state();

-- Start execution: requester or the supplier attached to the selected offer.
create or replace function public.start_request_execution(p_request_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.requests;
  v_offer public.offers;
  v_supplier_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'الطلب غير موجود.';
  end if;

  if v_request.status <> 'supplier_selected' then
    raise exception 'لا يمكن بدء التنفيذ إلا بعد اختيار مورد.';
  end if;

  if v_request.selected_offer_id is null then
    raise exception 'لا يوجد عرض مختار صالح لهذا الطلب.';
  end if;

  select * into v_offer
  from public.offers
  where id = v_request.selected_offer_id
    and request_id = p_request_id;

  if not found then
    raise exception 'العرض المختار غير صالح لهذا الطلب.';
  end if;

  select sp.user_id
    into v_supplier_user_id
  from public.supplier_profiles sp
  join public.profiles p on p.id = sp.user_id
  where sp.id = v_offer.supplier_id
    and p.role = 'supplier';

  if v_supplier_user_id is null then
    raise exception 'ملف المورد المرتبط بالعرض غير صالح.';
  end if;

  if v_request.requester_id <> v_user_id and v_supplier_user_id <> v_user_id then
    raise exception 'لا تملك صلاحية بدء تنفيذ هذا الطلب.';
  end if;

  update public.requests
  set status = 'in_progress',
      updated_at = now()
  where id = p_request_id;

  select * into v_request
  from public.requests
  where id = p_request_id;

  return v_request;
end;
$$;

-- Complete execution: requester or the supplier attached to the selected offer.
create or replace function public.complete_request(p_request_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.requests;
  v_offer public.offers;
  v_supplier_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'الطلب غير موجود.';
  end if;

  if v_request.status <> 'in_progress' then
    raise exception 'لا يمكن إكمال الطلب إلا إذا كان قيد التنفيذ.';
  end if;

  if v_request.selected_offer_id is null then
    raise exception 'لا يوجد عرض مختار صالح لهذا الطلب.';
  end if;

  select * into v_offer
  from public.offers
  where id = v_request.selected_offer_id
    and request_id = p_request_id;

  if not found then
    raise exception 'العرض المختار غير صالح لهذا الطلب.';
  end if;

  select sp.user_id
    into v_supplier_user_id
  from public.supplier_profiles sp
  join public.profiles p on p.id = sp.user_id
  where sp.id = v_offer.supplier_id
    and p.role = 'supplier';

  if v_supplier_user_id is null then
    raise exception 'ملف المورد المرتبط بالعرض غير صالح.';
  end if;

  if v_request.requester_id <> v_user_id and v_supplier_user_id <> v_user_id then
    raise exception 'لا تملك صلاحية إكمال هذا الطلب.';
  end if;

  update public.requests
  set status = 'completed',
      updated_at = now()
  where id = p_request_id;

  select * into v_request
  from public.requests
  where id = p_request_id;

  return v_request;
end;
$$;

-- Close an open request only while no supplier has been selected.
create or replace function public.close_request(p_request_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.requests;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'الطلب غير موجود.';
  end if;

  if v_request.requester_id <> v_user_id then
    raise exception 'لا يمكنك إغلاق طلب لا تملكه.';
  end if;

  if v_request.status <> 'open' then
    raise exception 'لا يمكن إغلاق الطلب إلا عندما يكون مفتوحًا.';
  end if;

  if v_request.selected_offer_id is not null then
    raise exception 'لا يمكن إغلاق طلب لديه عرض مختار.';
  end if;

  update public.requests
  set status = 'closed',
      updated_at = now()
  where id = p_request_id;

  select * into v_request
  from public.requests
  where id = p_request_id;

  return v_request;
end;
$$;

-- Cancel safely from an active non-terminal state. The requester may cancel
-- at any active stage; once a supplier is selected, only that supplier or the
-- requester may cancel. Closed/completed/cancelled requests are terminal.
create or replace function public.cancel_request(p_request_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.requests;
  v_offer public.offers;
  v_supplier_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'الطلب غير موجود.';
  end if;

  if v_request.status not in ('open', 'supplier_selected', 'in_progress') then
    raise exception 'لا يمكن إلغاء الطلب في حالته الحالية.';
  end if;

  if v_request.status = 'open' then
    if v_request.requester_id <> v_user_id then
      raise exception 'لا يمكنك إلغاء طلب لا تملكه.';
    end if;
  else
    if v_request.selected_offer_id is null then
      raise exception 'لا يوجد عرض مختار صالح لهذا الطلب.';
    end if;

    select * into v_offer
    from public.offers
    where id = v_request.selected_offer_id
      and request_id = p_request_id;

    if not found then
      raise exception 'العرض المختار غير صالح لهذا الطلب.';
    end if;

    select sp.user_id
      into v_supplier_user_id
    from public.supplier_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.id = v_offer.supplier_id
      and p.role = 'supplier';

    if v_supplier_user_id is null then
      raise exception 'ملف المورد المرتبط بالعرض غير صالح.';
    end if;

    if v_request.requester_id <> v_user_id and v_supplier_user_id <> v_user_id then
      raise exception 'لا تملك صلاحية إلغاء هذا الطلب.';
    end if;
  end if;

  update public.requests
  set status = 'cancelled',
      updated_at = now()
  where id = p_request_id;

  select * into v_request
  from public.requests
  where id = p_request_id;

  return v_request;
end;
$$;

revoke all on function public.start_request_execution(uuid) from public;
revoke all on function public.complete_request(uuid) from public;
revoke all on function public.close_request(uuid) from public;
revoke all on function public.cancel_request(uuid) from public;

grant execute on function public.start_request_execution(uuid) to authenticated;
grant execute on function public.complete_request(uuid) to authenticated;
grant execute on function public.close_request(uuid) to authenticated;
grant execute on function public.cancel_request(uuid) to authenticated;

-- ===== END ORIGINAL: 20260919230000_request_workflow_transitions.sql =====


-- ===== BEGIN ORIGINAL: 20260919233000_create_notifications.sql =====
-- MATLOOB Step 13: secure in-app notifications.
-- Notifications are generated by trusted database triggers tied to real events.
-- No client INSERT path is exposed.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  related_request_id uuid null references public.requests(id) on delete cascade,
  related_offer_id uuid null references public.offers(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (
    type in (
      'new_offer',
      'offer_selected',
      'request_started',
      'request_completed',
      'request_cancelled'
    )
  )
);

alter table public.notifications enable row level security;

revoke all on table public.notifications from authenticated;
grant select on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy "notifications_update_read_own"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Internal helper. It is callable only by database-owned trigger functions;
-- authenticated users receive no EXECUTE privilege.
create or replace function public.create_system_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_request_id uuid default null,
  p_offer_id uuid default null
)
returns public.notifications
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_notification public.notifications;
begin
  if p_user_id is null then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    title,
    message,
    type,
    related_request_id,
    related_offer_id
  )
  values (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_request_id,
    p_offer_id
  )
  returning * into v_notification;

  return v_notification;
end;
$$;

revoke all on function public.create_system_notification(uuid, text, text, text, uuid, uuid) from public;
revoke all on function public.create_system_notification(uuid, text, text, text, uuid, uuid) from authenticated;

-- New offer -> notify the request owner.
create or replace function public.notify_new_offer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.requests;
begin
  select * into v_request
  from public.requests
  where id = new.request_id;

  if found then
    perform public.create_system_notification(
      v_request.requester_id,
      'عرض جديد على طلبك',
      'تم تقديم عرض جديد على طلبك: ' || v_request.title,
      'new_offer',
      new.request_id,
      new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists offers_create_notification on public.offers;
create trigger offers_create_notification
after insert on public.offers
for each row
execute function public.notify_new_offer();

-- Offer selected -> notify the selected supplier.
create or replace function public.notify_offer_selected()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_supplier_user_id uuid;
begin
  if new.selected_offer_id is not null
     and new.selected_offer_id is distinct from old.selected_offer_id then
    select sp.user_id
      into v_supplier_user_id
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = new.selected_offer_id
      and o.request_id = new.id;

    if v_supplier_user_id is not null then
      perform public.create_system_notification(
        v_supplier_user_id,
        'تم اختيار عرضك',
        'تم اختيار عرضك للطلب: ' || new.title,
        'offer_selected',
        new.id,
        new.selected_offer_id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists requests_offer_selected_notification on public.requests;
create trigger requests_offer_selected_notification
after update of selected_offer_id on public.requests
for each row
execute function public.notify_offer_selected();

-- Request lifecycle event -> notify the other participant.
create or replace function public.notify_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_supplier_user_id uuid;
  v_recipient_id uuid;
  v_title text;
  v_message text;
  v_type text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status not in ('in_progress', 'completed', 'cancelled') then
    return new;
  end if;

  if new.selected_offer_id is not null then
    select sp.user_id
      into v_supplier_user_id
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = new.selected_offer_id
      and o.request_id = new.id;
  end if;

  if new.status = 'cancelled' and old.status = 'open' then
    -- No other participant exists yet when an open request is cancelled.
    return new;
  end if;

  if v_supplier_user_id is null then
    return new;
  end if;

  if auth.uid() = new.requester_id then
    v_recipient_id := v_supplier_user_id;
  elsif auth.uid() = v_supplier_user_id then
    v_recipient_id := new.requester_id;
  else
    -- A lifecycle RPC must only be callable by one of the two participants.
    return new;
  end if;

  if new.status = 'in_progress' then
    v_title := 'بدأ تنفيذ الطلب';
    v_message := 'بدأ تنفيذ الطلب: ' || new.title;
    v_type := 'request_started';
  elsif new.status = 'completed' then
    v_title := 'تم إكمال الطلب';
    v_message := 'تم إكمال الطلب: ' || new.title;
    v_type := 'request_completed';
  else
    v_title := 'تم إلغاء الطلب';
    v_message := 'تم إلغاء الطلب: ' || new.title;
    v_type := 'request_cancelled';
  end if;

  perform public.create_system_notification(
    v_recipient_id,
    v_title,
    v_message,
    v_type,
    new.id,
    new.selected_offer_id
  );

  return new;
end;
$$;

drop trigger if exists requests_status_notification on public.requests;
create trigger requests_status_notification
after update of status on public.requests
for each row
execute function public.notify_request_status_change();

revoke all on function public.notify_new_offer() from public;
revoke all on function public.notify_new_offer() from authenticated;
revoke all on function public.notify_offer_selected() from public;
revoke all on function public.notify_offer_selected() from authenticated;
revoke all on function public.notify_request_status_change() from public;
revoke all on function public.notify_request_status_change() from authenticated;

-- ===== END ORIGINAL: 20260919233000_create_notifications.sql =====


-- ===== BEGIN ORIGINAL: 20260920000000_create_reviews.sql =====
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_supplier_id uuid not null references public.supplier_profiles(user_id) on delete cascade,
  rating integer not null,
  comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_unique_request_reviewer unique (request_id, reviewer_id),
  constraint reviews_comment_length_check check (comment is null or char_length(comment) <= 2000)
);

create or replace function public.set_reviews_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reviews_set_updated_at
before update on public.reviews
for each row
execute function public.set_reviews_updated_at();

alter table public.reviews enable row level security;

revoke all on table public.reviews from authenticated;

grant select on table public.reviews to authenticated;

create policy reviews_select_authenticated
on public.reviews
for select
to authenticated
using (true);

create or replace function public.create_supplier_review(
  p_request_id uuid,
  p_rating integer,
  p_comment text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_request public.requests%rowtype;
  v_offer public.offers%rowtype;
  v_supplier_user_id uuid;
  v_existing public.reviews%rowtype;
  v_comment text;
  v_review public.reviews%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'معرّف الطلب مطلوب.' using errcode = '22023';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'التقييم يجب أن يكون بين 1 و5.' using errcode = '22023';
  end if;

  v_comment := nullif(btrim(coalesce(p_comment, '')), '');
  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception 'التعليق طويل جدًا. الحد الأقصى 2000 محرف.' using errcode = '22001';
  end if;

  select *
  into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'الطلب غير موجود.' using errcode = 'P0002';
  end if;

  if v_request.requester_id <> v_user_id then
    raise exception 'لا يمكنك تقييم هذا الطلب.' using errcode = '42501';
  end if;

  if v_request.status <> 'completed' then
    raise exception 'يمكن تقييم المورد بعد اكتمال الطلب فقط.' using errcode = '22023';
  end if;

  if v_request.selected_offer_id is null then
    raise exception 'لا يوجد عرض مختار لهذا الطلب.' using errcode = '22023';
  end if;

  select *
  into v_offer
  from public.offers
  where id = v_request.selected_offer_id
    and request_id = v_request.id;

  if not found then
    raise exception 'العرض المختار غير صالح.' using errcode = '22023';
  end if;

  select sp.user_id
  into v_supplier_user_id
  from public.supplier_profiles sp
  where sp.id = v_offer.supplier_id;

  if v_supplier_user_id is null then
    raise exception 'المورد المرتبط بالعرض غير صالح.' using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.reviews
  where request_id = v_request.id
    and reviewer_id = v_user_id;

  if found then
    raise exception 'تم تقييم هذا الطلب مسبقًا.' using errcode = '23505';
  end if;

  insert into public.reviews (
    request_id,
    reviewer_id,
    reviewed_supplier_id,
    rating,
    comment
  )
  values (
    v_request.id,
    v_user_id,
    v_supplier_user_id,
    p_rating,
    v_comment
  )
  returning * into v_review;

  return v_review;
end;
$$;

revoke all on function public.create_supplier_review(uuid, integer, text) from public;
revoke all on function public.create_supplier_review(uuid, integer, text) from authenticated;
grant execute on function public.create_supplier_review(uuid, integer, text) to authenticated;

revoke insert on table public.reviews from authenticated;
revoke update on table public.reviews from authenticated;
revoke delete on table public.reviews from authenticated;

revoke all on function public.set_reviews_updated_at() from public;
revoke all on function public.set_reviews_updated_at() from authenticated;

-- ===== END ORIGINAL: 20260920000000_create_reviews.sql =====
