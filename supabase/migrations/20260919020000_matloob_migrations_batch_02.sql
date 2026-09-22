-- MATLOOB merged migration batch 2/3
-- Files preserved in original timestamp order:


-- ===== BEGIN ORIGINAL: 20260920010000_create_supplier_portfolio.sql =====
-- Step 15: real supplier portfolio metadata + Supabase Storage bucket/policies.

create table if not exists public.supplier_portfolio (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_profiles(user_id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_portfolio_file_type_check
    check (lower(file_type) in ('image/jpeg', 'image/png', 'image/webp')),
  constraint supplier_portfolio_file_size_check
    check (file_size > 0 and file_size <= 5242880),
  constraint supplier_portfolio_storage_path_check
    check (storage_path ~ '^[0-9a-fA-F-]{36}/portfolio/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$')
);

create index if not exists supplier_portfolio_supplier_id_idx
  on public.supplier_portfolio (supplier_id);

create index if not exists supplier_portfolio_sort_order_idx
  on public.supplier_portfolio (sort_order);

create or replace function public.set_supplier_portfolio_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger supplier_portfolio_set_updated_at
before update on public.supplier_portfolio
for each row
execute function public.set_supplier_portfolio_updated_at();

alter table public.supplier_portfolio enable row level security;

revoke all on table public.supplier_portfolio from authenticated;
grant select, insert, update, delete on table public.supplier_portfolio to authenticated;

create policy supplier_portfolio_select_authenticated
on public.supplier_portfolio
for select
to authenticated
using (true);

create policy supplier_portfolio_insert_own
on public.supplier_portfolio
for insert
to authenticated
with check (
  supplier_id = auth.uid()
  and storage_path like (auth.uid()::text || '/portfolio/%')
);

create policy supplier_portfolio_update_own
on public.supplier_portfolio
for update
to authenticated
using (supplier_id = auth.uid())
with check (
  supplier_id = auth.uid()
  and storage_path like (auth.uid()::text || '/portfolio/%')
);

create policy supplier_portfolio_delete_own
on public.supplier_portfolio
for delete
to authenticated
using (supplier_id = auth.uid());


-- Public read is intentional for the supplier-work portfolio bucket so supplier
-- profile pages can render portfolio images without exposing Storage secrets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-work',
  'supplier-work',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy supplier_work_public_read
on storage.objects
for select
to public
using (bucket_id = 'supplier-work');

create policy supplier_work_insert_own_folder
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'supplier-work'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'portfolio'
  and lower((storage.extension(name))) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy supplier_work_update_own_folder
on storage.objects
for update
to authenticated
using (
  bucket_id = 'supplier-work'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'portfolio'
)
with check (
  bucket_id = 'supplier-work'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'portfolio'
  and lower((storage.extension(name))) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy supplier_work_delete_own_folder
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'supplier-work'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'portfolio'
);

revoke all on function public.set_supplier_portfolio_updated_at() from public;
revoke all on function public.set_supplier_portfolio_updated_at() from authenticated;

-- ===== END ORIGINAL: 20260920010000_create_supplier_portfolio.sql =====


-- ===== BEGIN ORIGINAL: 20260920020000_create_request_attachments.sql =====
-- Step 16: private request/offer attachments.

create table public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_attachments_file_size_check check (file_size > 0 and file_size <= 10485760),
  constraint request_attachments_file_type_check check (lower(file_type) in ('image/jpeg','image/png','image/webp','application/pdf')),
  constraint request_attachments_storage_path_check check (storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|pdf)$')
);

create index request_attachments_request_id_idx on public.request_attachments(request_id);
create index request_attachments_uploaded_by_idx on public.request_attachments(uploaded_by);

create table public.offer_attachments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_attachments_file_size_check check (file_size > 0 and file_size <= 10485760),
  constraint offer_attachments_file_type_check check (lower(file_type) in ('image/jpeg','image/png','image/webp','application/pdf')),
  constraint offer_attachments_storage_path_check check (storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|pdf)$')
);

create index offer_attachments_offer_id_idx on public.offer_attachments(offer_id);
create index offer_attachments_uploaded_by_idx on public.offer_attachments(uploaded_by);

create or replace function public.set_attachment_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger request_attachments_set_updated_at
before update on public.request_attachments
for each row execute function public.set_attachment_updated_at();

create trigger offer_attachments_set_updated_at
before update on public.offer_attachments
for each row execute function public.set_attachment_updated_at();

alter table public.request_attachments enable row level security;
alter table public.offer_attachments enable row level security;

revoke all on table public.request_attachments from authenticated;
revoke all on table public.offer_attachments from authenticated;
grant select, insert, delete on table public.request_attachments to authenticated;
grant select, insert, delete on table public.offer_attachments to authenticated;

-- Request attachments: readers must already have access to the request.
create policy request_attachments_select_visible_request
on public.request_attachments
for select to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.id = request_attachments.request_id
      and (
        r.status = 'open'
        or r.requester_id = auth.uid()
        or exists (
          select 1
          from public.offers o
          join public.supplier_profiles sp on sp.id = o.supplier_id
          where o.id = r.selected_offer_id
            and sp.user_id = auth.uid()
        )
      )
  )
);

create policy request_attachments_insert_owner
on public.request_attachments
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.requests r
    where r.id = request_attachments.request_id
      and r.requester_id = auth.uid()
  )
);

create policy request_attachments_delete_owner
on public.request_attachments
for delete to authenticated
using (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.requests r
    where r.id = request_attachments.request_id
      and r.requester_id = auth.uid()
  )
);

-- Offer attachments: only offer owner or request owner may read.
create policy offer_attachments_select_participants
on public.offer_attachments
for select to authenticated
using (
  exists (
    select 1
    from public.offers o
    join public.requests r on r.id = o.request_id
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = offer_attachments.offer_id
      and (sp.user_id = auth.uid() or r.requester_id = auth.uid())
  )
);

create policy offer_attachments_insert_owner
on public.offer_attachments
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = offer_attachments.offer_id
      and sp.user_id = auth.uid()
  )
);

create policy offer_attachments_delete_owner
on public.offer_attachments
for delete to authenticated
using (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = offer_attachments.offer_id
      and sp.user_id = auth.uid()
  )
);

-- Private buckets: no public access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('request-attachments', 'request-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('offer-attachments', 'offer-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage path format is request/offer UUID followed by file UUID and extension.
-- Database ownership checks are repeated here so knowing a path is not enough.
create policy request_attachments_storage_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'request-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and (storage.foldername(name))[1] <> ''
  and (storage.foldername(name))[1]::uuid is not null
  and exists (
    select 1 from public.requests r
    where r.id = (storage.foldername(name))[1]::uuid
      and r.requester_id = auth.uid()
  )
  and (
    (lower(storage.extension(name)) in ('jpg','jpeg') and lower(coalesce((metadata->>'mimetype'), '')) = 'image/jpeg')
    or (lower(storage.extension(name)) = 'png' and lower(coalesce((metadata->>'mimetype'), '')) = 'image/png')
    or (lower(storage.extension(name)) = 'webp' and lower(coalesce((metadata->>'mimetype'), '')) = 'image/webp')
    or (lower(storage.extension(name)) = 'pdf' and lower(coalesce((metadata->>'mimetype'), '')) = 'application/pdf')
  )
);

create policy request_attachments_storage_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'request-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and (storage.foldername(name))[1]::uuid is not null
  and exists (
    select 1
    from public.requests r
    where r.id = (storage.foldername(name))[1]::uuid
      and (
        r.status = 'open'
        or r.requester_id = auth.uid()
        or exists (
          select 1
          from public.offers o
          join public.supplier_profiles sp on sp.id = o.supplier_id
          where o.id = r.selected_offer_id
            and sp.user_id = auth.uid()
        )
      )
  )
);

create policy request_attachments_storage_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'request-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and (storage.foldername(name))[1]::uuid is not null
  and exists (
    select 1 from public.requests r
    where r.id = (storage.foldername(name))[1]::uuid
      and r.requester_id = auth.uid()
  )
)
with check (
  bucket_id = 'request-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and (storage.foldername(name))[1]::uuid is not null
  and exists (
    select 1 from public.requests r
    where r.id = (storage.foldername(name))[1]::uuid
      and r.requester_id = auth.uid()
  )
  and (
    (lower(storage.extension(name)) in ('jpg','jpeg') and lower(coalesce((metadata->>'mimetype'), '')) = 'image/jpeg')
    or (lower(storage.extension(name)) = 'png' and lower(coalesce((metadata->>'mimetype'), '')) = 'image/png')
    or (lower(storage.extension(name)) = 'webp' and lower(coalesce((metadata->>'mimetype'), '')) = 'image/webp')
    or (lower(storage.extension(name)) = 'pdf' and lower(coalesce((metadata->>'mimetype'), '')) = 'application/pdf')
  )
);

create policy request_attachments_storage_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'request-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and (storage.foldername(name))[1]::uuid is not null
  and exists (
    select 1 from public.requests r
    where r.id = (storage.foldername(name))[1]::uuid
      and r.requester_id = auth.uid()
  )
);

create policy offer_attachments_storage_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'offer-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and (storage.foldername(name))[1]::uuid is not null
  and exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = (storage.foldername(name))[1]::uuid
      and sp.user_id = auth.uid()
  )
  and (
    (lower(storage.extension(name)) in ('jpg','jpeg') and lower(coalesce((metadata->>'mimetype'), '')) = 'image/jpeg')
    or (lower(storage.extension(name)) = 'png' and lower(coalesce((metadata->>'mimetype'), '')) = 'image/png')
    or (lower(storage.extension(name)) = 'webp' and lower(coalesce((metadata->>'mimetype'), '')) = 'image/webp')
    or (lower(storage.extension(name)) = 'pdf' and lower(coalesce((metadata->>'mimetype'), '')) = 'application/pdf')
  )
);

create policy offer_attachments_storage_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'offer-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and (storage.foldername(name))[1]::uuid is not null
  and exists (
    select 1
    from public.offers o
    join public.requests r on r.id = o.request_id
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = (storage.foldername(name))[1]::uuid
      and (sp.user_id = auth.uid() or r.requester_id = auth.uid())
  )
);

create policy offer_attachments_storage_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'offer-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and (storage.foldername(name))[1]::uuid is not null
  and exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = (storage.foldername(name))[1]::uuid
      and sp.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'offer-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and (storage.foldername(name))[1]::uuid is not null
  and exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = (storage.foldername(name))[1]::uuid
      and sp.user_id = auth.uid()
  )
  and (
    (lower(storage.extension(name)) in ('jpg','jpeg') and lower(coalesce((metadata->>'mimetype'), '')) = 'image/jpeg')
    or (lower(storage.extension(name)) = 'png' and lower(coalesce((metadata->>'mimetype'), '')) = 'image/png')
    or (lower(storage.extension(name)) = 'webp' and lower(coalesce((metadata->>'mimetype'), '')) = 'image/webp')
    or (lower(storage.extension(name)) = 'pdf' and lower(coalesce((metadata->>'mimetype'), '')) = 'application/pdf')
  )
);

create policy offer_attachments_storage_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'offer-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and (storage.foldername(name))[1]::uuid is not null
  and exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = (storage.foldername(name))[1]::uuid
      and sp.user_id = auth.uid()
  )
);

revoke all on function public.set_attachment_updated_at() from public;
revoke all on function public.set_attachment_updated_at() from authenticated;

-- ===== END ORIGINAL: 20260920020000_create_request_attachments.sql =====


-- ===== BEGIN ORIGINAL: 20260920030000_search_pagination.sql =====
-- MATLOOB Step 17: server-side search, filtering, and pagination.
-- Adds read-only, parameterized search RPCs only. No existing workflow/offer/review/attachment logic is changed.

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
language sql
stable
set search_path = pg_catalog, public
as $$
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
  where (p_search is null or btrim(p_search) = '' or position(lower(btrim(p_search)) in lower(coalesce(r.title, ''))) > 0 or position(lower(btrim(p_search)) in lower(coalesce(r.description, ''))) > 0)
    and (p_category_id is null or r.category_id = p_category_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_status is null or r.status = p_status)
    and (p_min_quantity is null or (r.quantity is not null and r.quantity >= p_min_quantity))
    and (p_delivery_before is null or (r.deadline is not null and r.deadline <= p_delivery_before))
  order by
    case when p_ascending then r.created_at end asc,
    case when not p_ascending then r.created_at end desc,
    r.id desc
  offset greatest(p_page - 1, 0) * least(greatest(p_page_size, 1), 100)
  limit least(greatest(p_page_size, 1), 100);
$$;

revoke all on function public.search_requests(text, uuid, uuid, text, numeric, date, boolean, integer, integer) from public;
revoke all on function public.search_requests(text, uuid, uuid, text, numeric, date, boolean, integer, integer) from anon;
grant execute on function public.search_requests(text, uuid, uuid, text, numeric, date, boolean, integer, integer) to authenticated;

create or replace function public.search_supplier_directory(
  p_search text default null,
  p_category_id uuid default null,
  p_city_id uuid default null,
  p_min_rating numeric default null,
  p_page integer default 1,
  p_page_size integer default 12
)
returns table (
  id uuid,
  user_id uuid,
  company_name text,
  business_type text,
  description text,
  city_id uuid,
  location_text text,
  years_experience integer,
  phone text,
  contact_info text,
  created_at timestamptz,
  updated_at timestamptz,
  city_name text,
  rating_average numeric,
  rating_count bigint,
  categories jsonb,
  total_count bigint
)
language sql
stable
set search_path = pg_catalog, public
as $$
  with base as (
    select
      sp.id,
      sp.user_id,
      sp.company_name,
      sp.business_type,
      sp.description,
      sp.city_id,
      sp.location_text,
      sp.years_experience,
      sp.phone,
      sp.contact_info,
      sp.created_at,
      sp.updated_at,
      c.name as city_name,
      coalesce(avg(rv.rating)::numeric, null) as rating_average,
      count(rv.id)::bigint as rating_count
    from public.supplier_profiles sp
    left join public.cities c on c.id = sp.city_id
    left join public.reviews rv on rv.reviewed_supplier_id = sp.user_id
    where (p_search is null or btrim(p_search) = ''
      or position(lower(btrim(p_search)) in lower(coalesce(sp.company_name, ''))) > 0
      or position(lower(btrim(p_search)) in lower(coalesce(sp.business_type, ''))) > 0
      or position(lower(btrim(p_search)) in lower(coalesce(sp.description, ''))) > 0)
      and (p_city_id is null or sp.city_id = p_city_id)
      and (p_category_id is null or exists (
        select 1 from public.supplier_categories sc
        where sc.supplier_id = sp.id and sc.category_id = p_category_id
      ))
    group by sp.id, c.name
  ),
  filtered as (
    select * from base
    where p_min_rating is null or (rating_average is not null and rating_average >= p_min_rating)
  )
  select
    f.id,
    f.user_id,
    f.company_name,
    f.business_type,
    f.description,
    f.city_id,
    f.location_text,
    f.years_experience,
    f.phone,
    f.contact_info,
    f.created_at,
    f.updated_at,
    f.city_name,
    f.rating_average,
    f.rating_count,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cat.id,
        'name', cat.name,
        'slug', cat.slug,
        'created_at', cat.created_at
      ) order by cat.name)
      from public.supplier_categories sc
      join public.categories cat on cat.id = sc.category_id
      where sc.supplier_id = f.id
    ), '[]'::jsonb) as categories,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc, f.id desc
  offset greatest(p_page - 1, 0) * least(greatest(p_page_size, 1), 100)
  limit least(greatest(p_page_size, 1), 100);
$$;

revoke all on function public.search_supplier_directory(text, uuid, uuid, numeric, integer, integer) from public;
revoke all on function public.search_supplier_directory(text, uuid, uuid, numeric, integer, integer) from anon;
grant execute on function public.search_supplier_directory(text, uuid, uuid, numeric, integer, integer) to authenticated;

-- ===== END ORIGINAL: 20260920030000_search_pagination.sql =====


-- ===== BEGIN ORIGINAL: 20260920040000_create_subscription_system.sql =====
-- MATLOOB Step 18: subscription foundation (FREE / PRO).
-- No payment, admin activation, notifications, or automatic PRO activation.

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_syp numeric(12,2) not null default 0,
  duration_days integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plans_code_check check (code in ('FREE', 'PRO')),
  constraint subscription_plans_price_check check (price_syp >= 0),
  constraint subscription_plans_duration_check check (duration_days >= 0)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null,
  started_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check check (status in ('pending', 'active', 'expired', 'cancelled'))
);

create index subscriptions_user_id_idx on public.subscriptions(user_id);
create index subscriptions_user_status_idx on public.subscriptions(user_id, status);
create index subscriptions_expires_at_idx on public.subscriptions(expires_at);


create unique index subscriptions_one_active_per_user_idx
  on public.subscriptions(user_id)
  where status = 'active';

create or replace function public.set_subscription_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger subscription_plans_set_updated_at
before update on public.subscription_plans
for each row execute function public.set_subscription_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_subscription_updated_at();

insert into public.subscription_plans (code, name, price_syp, duration_days, is_active)
values
  ('FREE', 'مجاني', 0, 0, true),
  ('PRO', 'PRO', 500, 30, true)
on conflict (code) do update set
  name = excluded.name,
  price_syp = excluded.price_syp,
  duration_days = excluded.duration_days,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;

revoke all on table public.subscription_plans from anon, authenticated;
revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscription_plans to authenticated;
grant select on table public.subscriptions to authenticated;

drop policy if exists subscription_plans_read_active on public.subscription_plans;
create policy subscription_plans_read_active
on public.subscription_plans
for select
to authenticated
using (is_active = true);

drop policy if exists subscriptions_read_own on public.subscriptions;
create policy subscriptions_read_own
on public.subscriptions
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.has_active_pro_subscription(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() = p_user_id
    and exists (
      select 1
      from public.subscriptions s
      join public.subscription_plans p on p.id = s.plan_id
      join public.profiles pr on pr.id = s.user_id
      where s.user_id = p_user_id
        and pr.role = 'supplier'
        and p.code = 'PRO'
        and p.is_active = true
        and s.status = 'active'
        and s.expires_at is not null
        and s.expires_at > now()
    );
$$;

revoke all on function public.has_active_pro_subscription(uuid) from public;
revoke all on function public.has_active_pro_subscription(uuid) from anon;
grant execute on function public.has_active_pro_subscription(uuid) to authenticated;

create or replace function public.get_current_subscription()
returns table (
  id uuid,
  user_id uuid,
  plan_id uuid,
  plan_code text,
  plan_name text,
  price_syp numeric,
  duration_days integer,
  status text,
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with latest as (
    select
      s.id,
      s.user_id,
      s.plan_id,
      p.code as plan_code,
      p.name as plan_name,
      p.price_syp,
      p.duration_days,
      case
        when p.code = 'PRO' and s.status = 'active' and s.expires_at is not null and s.expires_at <= now() then 'expired'
        else s.status
      end as effective_status,
      s.started_at,
      s.expires_at,
      s.created_at,
      s.updated_at,
      row_number() over (
        order by
          case when s.status = 'active' and s.expires_at > now() then 0 else 1 end,
          s.created_at desc,
          s.id desc
      ) as rn
    from public.subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.user_id = auth.uid()
  )
  select id, user_id, plan_id, plan_code, plan_name, price_syp, duration_days,
         effective_status, started_at, expires_at, created_at, updated_at
  from latest
  where rn = 1;
$$;

revoke all on function public.get_current_subscription() from public;
revoke all on function public.get_current_subscription() from anon;
grant execute on function public.get_current_subscription() to authenticated;

create or replace function public.create_pro_subscription_request()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_existing boolean;
  v_subscription_id uuid;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id and role = 'supplier') then
    raise exception 'اشتراك PRO متاح للموردين فقط.';
  end if;

  select id into v_plan_id
  from public.subscription_plans
  where code = 'PRO' and is_active = true
  limit 1;

  if v_plan_id is null then
    raise exception 'خطة PRO غير متاحة حاليًا.';
  end if;

  select exists (
    select 1 from public.subscriptions s
    where s.user_id = v_user_id
      and s.plan_id = v_plan_id
      and (
        (s.status = 'active' and s.expires_at is not null and s.expires_at > now())
        or s.status = 'pending'
      )
  ) into v_existing;

  if v_existing then
    raise exception 'يوجد اشتراك PRO فعال أو طلب قيد المراجعة بالفعل.';
  end if;

  insert into public.subscriptions (user_id, plan_id, status)
  values (v_user_id, v_plan_id, 'pending')
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

revoke all on function public.create_pro_subscription_request() from public;
revoke all on function public.create_pro_subscription_request() from anon;
grant execute on function public.create_pro_subscription_request() to authenticated;

-- No INSERT/UPDATE/DELETE grants are given to authenticated users on subscriptions.
-- Therefore a browser user cannot activate PRO, change status, extend expiry, change plan,
-- or change ownership directly. Future admin activation can be added separately.

-- ===== END ORIGINAL: 20260920040000_create_subscription_system.sql =====


-- ===== BEGIN ORIGINAL: 20260920050000_admin_pro_management.sql =====
-- MATLOOB Step 19: Admin-only PRO subscription management.
-- No public/admin registration UI, payments, notifications, or broader admin dashboard.

create table public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

-- Admin membership is intentionally provisioned outside the public application UI.
-- Example for the Supabase SQL editor (replace with a real auth user UUID):
-- insert into public.admin_users (user_id) values ('AUTH-USER-UUID');
-- No authenticated INSERT/UPDATE/DELETE privilege is granted.

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() is not null
    and auth.uid() = p_user_id
    and exists (
      select 1
      from public.admin_users au
      where au.user_id = p_user_id
    );
$$;

revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_admin(uuid) from anon;
grant execute on function public.is_admin(uuid) to authenticated;

create or replace function public.get_admin_pro_subscriptions()
returns table (
  id uuid,
  user_id uuid,
  supplier_name text,
  company_name text,
  business_type text,
  plan_code text,
  plan_name text,
  status text,
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة اشتراكات PRO.';
  end if;

  return query
  select
    s.id,
    s.user_id,
    pr.full_name,
    sp.company_name,
    sp.business_type,
    p.code,
    p.name,
    case
      when s.status = 'active' and s.expires_at is not null and s.expires_at <= now() then 'expired'
      else s.status
    end,
    s.started_at,
    s.expires_at,
    s.created_at,
    s.updated_at
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  join public.profiles pr on pr.id = s.user_id
  left join public.supplier_profiles sp on sp.user_id = s.user_id
  where p.code = 'PRO'
  order by s.created_at desc, s.id desc;
end;
$$;

revoke all on function public.get_admin_pro_subscriptions() from public;
revoke all on function public.get_admin_pro_subscriptions() from anon;
grant execute on function public.get_admin_pro_subscriptions() to authenticated;

create or replace function public.get_admin_pending_pro_subscriptions()
returns table (
  id uuid,
  user_id uuid,
  supplier_name text,
  company_name text,
  business_type text,
  plan_code text,
  plan_name text,
  status text,
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة اشتراكات PRO.';
  end if;

  return query
  select
    s.id,
    s.user_id,
    pr.full_name,
    sp.company_name,
    sp.business_type,
    p.code,
    p.name,
    s.status,
    s.started_at,
    s.expires_at,
    s.created_at,
    s.updated_at
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  join public.profiles pr on pr.id = s.user_id
  left join public.supplier_profiles sp on sp.user_id = s.user_id
  where p.code = 'PRO'
    and s.status = 'pending'
  order by s.created_at asc, s.id asc;
end;
$$;

revoke all on function public.get_admin_pending_pro_subscriptions() from public;
revoke all on function public.get_admin_pending_pro_subscriptions() from anon;
grant execute on function public.get_admin_pending_pro_subscriptions() to authenticated;

create or replace function public.admin_activate_pro_subscription(
  p_subscription_id uuid,
  p_started_at timestamptz default null,
  p_expires_at timestamptz default null
)
returns public.subscriptions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_subscription public.subscriptions;
  v_plan public.subscription_plans;
  v_started_at timestamptz;
  v_expires_at timestamptz;
  v_active_exists boolean;
begin
  if v_admin_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  if not public.is_admin(v_admin_id) then
    raise exception 'لا تملك صلاحية تنفيذ هذه العملية.';
  end if;

  select * into v_subscription
  from public.subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    raise exception 'الاشتراك غير موجود.';
  end if;

  select * into v_plan
  from public.subscription_plans
  where id = v_subscription.plan_id
  for update;

  if v_plan.code <> 'PRO' then
    raise exception 'يمكن إدارة اشتراكات PRO فقط.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_subscription.user_id and role = 'supplier'
  ) then
    raise exception 'اشتراك PRO يجب أن يكون تابعًا لمورد.';
  end if;

  if v_subscription.status <> 'pending' then
    raise exception 'يمكن تفعيل طلبات PRO المعلقة فقط.';
  end if;

  select exists (
    select 1
    from public.subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.user_id = v_subscription.user_id
      and p.code = 'PRO'
      and s.status = 'active'
      and s.expires_at is not null
      and s.expires_at > now()
  ) into v_active_exists;

  if v_active_exists then
    raise exception 'يوجد اشتراك PRO فعال لهذا المورد بالفعل.';
  end if;

  v_started_at := coalesce(p_started_at, now());
  v_expires_at := coalesce(
    p_expires_at,
    v_started_at + make_interval(days => v_plan.duration_days)
  );

  if v_started_at > now() then
    raise exception 'تاريخ بداية الاشتراك لا يمكن أن يكون في المستقبل.';
  end if;

  if v_expires_at <= v_started_at or v_expires_at <= now() then
    raise exception 'تاريخ انتهاء الاشتراك يجب أن يكون بعد البداية وبعد الوقت الحالي.';
  end if;

  update public.subscriptions
  set
    status = 'active',
    started_at = v_started_at,
    expires_at = v_expires_at
  where id = v_subscription.id
  returning * into v_subscription;

  return v_subscription;
end;
$$;

revoke all on function public.admin_activate_pro_subscription(uuid, timestamptz, timestamptz) from public;
revoke all on function public.admin_activate_pro_subscription(uuid, timestamptz, timestamptz) from anon;
grant execute on function public.admin_activate_pro_subscription(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.admin_cancel_pro_subscription(p_subscription_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_subscription public.subscriptions;
  v_plan_code text;
begin
  if v_admin_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  if not public.is_admin(v_admin_id) then
    raise exception 'لا تملك صلاحية تنفيذ هذه العملية.';
  end if;

  select s.*
  into v_subscription
  from public.subscriptions s
  where s.id = p_subscription_id
  for update;

  if v_subscription.id is null then
    raise exception 'الاشتراك غير موجود.';
  end if;

  select p.code into v_plan_code
  from public.subscription_plans p
  where p.id = v_subscription.plan_id;

  if v_plan_code <> 'PRO' then
    raise exception 'يمكن إدارة اشتراكات PRO فقط.';
  end if;

  if v_subscription.status not in ('active', 'pending') then
    raise exception 'لا يمكن إلغاء هذا الاشتراك من حالته الحالية.';
  end if;

  update public.subscriptions
  set status = 'cancelled'
  where id = v_subscription.id
  returning * into v_subscription;

  return v_subscription;
end;
$$;

revoke all on function public.admin_cancel_pro_subscription(uuid) from public;
revoke all on function public.admin_cancel_pro_subscription(uuid) from anon;
grant execute on function public.admin_cancel_pro_subscription(uuid) to authenticated;

create or replace function public.admin_extend_pro_subscription(
  p_subscription_id uuid,
  p_days integer
)
returns public.subscriptions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_subscription public.subscriptions;
  v_plan_code text;
  v_base_expiration timestamptz;
  v_new_expiration timestamptz;
begin
  if v_admin_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  if not public.is_admin(v_admin_id) then
    raise exception 'لا تملك صلاحية تنفيذ هذه العملية.';
  end if;

  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'مدة التمديد يجب أن تكون بين يوم واحد و3650 يومًا.';
  end if;

  select s.*
  into v_subscription
  from public.subscriptions s
  where s.id = p_subscription_id
  for update;

  if v_subscription.id is null then
    raise exception 'الاشتراك غير موجود.';
  end if;

  select p.code into v_plan_code
  from public.subscription_plans p
  where p.id = v_subscription.plan_id;

  if v_plan_code <> 'PRO' then
    raise exception 'يمكن إدارة اشتراكات PRO فقط.';
  end if;

  if v_subscription.status not in ('active', 'expired') then
    raise exception 'يمكن تمديد اشتراك PRO فعال أو منتهٍ فقط.';
  end if;

  v_base_expiration := case
    when v_subscription.expires_at is not null and v_subscription.expires_at > now()
      then v_subscription.expires_at
    else now()
  end;

  v_new_expiration := v_base_expiration + make_interval(days => p_days);

  update public.subscriptions
  set
    status = 'active',
    started_at = coalesce(v_subscription.started_at, now()),
    expires_at = v_new_expiration
  where id = v_subscription.id
  returning * into v_subscription;

  return v_subscription;
end;
$$;

revoke all on function public.admin_extend_pro_subscription(uuid, integer) from public;
revoke all on function public.admin_extend_pro_subscription(uuid, integer) from anon;
grant execute on function public.admin_extend_pro_subscription(uuid, integer) to authenticated;

create or replace function public.admin_set_pro_expiration(
  p_subscription_id uuid,
  p_expires_at timestamptz
)
returns public.subscriptions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_subscription public.subscriptions;
  v_plan_code text;
  v_new_status text;
begin
  if v_admin_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  if not public.is_admin(v_admin_id) then
    raise exception 'لا تملك صلاحية تنفيذ هذه العملية.';
  end if;

  if p_expires_at is null then
    raise exception 'يجب تحديد تاريخ انتهاء صحيح.';
  end if;

  select s.*
  into v_subscription
  from public.subscriptions s
  where s.id = p_subscription_id
  for update;

  if v_subscription.id is null then
    raise exception 'الاشتراك غير موجود.';
  end if;

  select p.code into v_plan_code
  from public.subscription_plans p
  where p.id = v_subscription.plan_id;

  if v_plan_code <> 'PRO' then
    raise exception 'يمكن إدارة اشتراكات PRO فقط.';
  end if;

  if v_subscription.status not in ('active', 'expired') then
    raise exception 'يمكن تحديد تاريخ انتهاء لاشتراك PRO فعال أو منتهٍ فقط.';
  end if;

  if p_expires_at <= coalesce(v_subscription.started_at, now()) then
    raise exception 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.';
  end if;

  if v_subscription.status = 'active' and p_expires_at <= now() then
    raise exception 'لا يمكن ضبط اشتراك نشط على تاريخ انتهاء في الماضي.';
  end if;

  v_new_status := case when p_expires_at > now() then 'active' else 'expired' end;

  update public.subscriptions
  set
    status = v_new_status,
    started_at = coalesce(v_subscription.started_at, now()),
    expires_at = p_expires_at
  where id = v_subscription.id
  returning * into v_subscription;

  return v_subscription;
end;
$$;

revoke all on function public.admin_set_pro_expiration(uuid, timestamptz) from public;
revoke all on function public.admin_set_pro_expiration(uuid, timestamptz) from anon;
grant execute on function public.admin_set_pro_expiration(uuid, timestamptz) to authenticated;

-- Explicitly keep direct authenticated writes disabled on subscription records.
revoke insert, update, delete on table public.subscriptions from authenticated;
revoke insert, update, delete on table public.admin_users from authenticated;

-- ===== END ORIGINAL: 20260920050000_admin_pro_management.sql =====


-- ===== BEGIN ORIGINAL: 20260920060000_supplier_verification.sql =====
-- MATLOOB Step 20: Supplier verification only.
-- Verification is independent from PRO and is administered through secure RPCs.

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_profiles(user_id) on delete cascade,
  status text not null default 'pending',
  notes text null,
  admin_notes text null,
  reviewed_by uuid null references public.profiles(id),
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verification_requests_status_check check (status in ('pending','approved','rejected','cancelled'))
);

create index verification_requests_supplier_id_idx on public.verification_requests(supplier_id);
create index verification_requests_status_idx on public.verification_requests(status);
create unique index verification_requests_one_pending_supplier_idx
  on public.verification_requests(supplier_id)
  where status = 'pending';

create or replace function public.set_verification_requests_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger verification_requests_set_updated_at
before update on public.verification_requests
for each row execute function public.set_verification_requests_updated_at();

alter table public.verification_requests enable row level security;

-- Existing supplier profile writes must never be able to change verified.
-- Keep owner profile editing available through explicit column privileges.
revoke update on table public.supplier_profiles from authenticated;
grant update (
  company_name, business_type, description, city_id, location_text,
  years_experience, phone, contact_info
) on table public.supplier_profiles to authenticated;

revoke insert on table public.supplier_profiles from authenticated;
grant insert (
  user_id, company_name, business_type, description, city_id, location_text,
  years_experience, phone, contact_info
) on table public.supplier_profiles to authenticated;

-- Verification metadata is readable only by its owner or an Admin.
drop policy if exists "verification_requests_select_own" on public.verification_requests;
create policy "verification_requests_select_own"
on public.verification_requests
for select
to authenticated
using (
  supplier_id = auth.uid()
  or public.is_admin(auth.uid())
);

-- No direct authenticated INSERT/UPDATE/DELETE is granted.
revoke insert, update, delete on table public.verification_requests from anon, authenticated;

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
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id and role = 'supplier'
  ) then
    raise exception 'طلب التوثيق متاح للموردين فقط.';
  end if;

  select * into v_profile
  from public.supplier_profiles
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'يجب إنشاء ملف المورد أولًا.';
  end if;

  if v_profile.verified then
    raise exception 'حسابك موثّق بالفعل.';
  end if;

  select * into v_existing
  from public.verification_requests
  where supplier_id = v_user_id and status = 'pending'
  limit 1;

  if found then
    raise exception 'لديك طلب توثيق قيد المراجعة بالفعل.';
  end if;

  insert into public.verification_requests (supplier_id, status)
  values (v_user_id, 'pending')
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.create_verification_request() from public, anon;
grant execute on function public.create_verification_request() to authenticated;

create or replace function public.cancel_verification_request(p_request_id uuid)
returns public.verification_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.verification_requests;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id and role = 'supplier'
  ) then
    raise exception 'إلغاء طلب التوثيق متاح للموردين فقط.';
  end if;

  select * into v_request
  from public.verification_requests
  where id = p_request_id and supplier_id = v_user_id
  for update;

  if not found then
    raise exception 'طلب التوثيق غير موجود.';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'يمكن إلغاء الطلبات المعلقة فقط.';
  end if;

  update public.verification_requests
  set status = 'cancelled'
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.cancel_verification_request(uuid) from public, anon;
grant execute on function public.cancel_verification_request(uuid) to authenticated;

create or replace function public.get_admin_verification_requests()
returns table (
  id uuid,
  supplier_id uuid,
  supplier_name text,
  company_name text,
  business_type text,
  city_name text,
  status text,
  notes text,
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  verified boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية إدارة طلبات التوثيق.';
  end if;

  return query
  select
    vr.id,
    vr.supplier_id,
    p.full_name,
    sp.company_name,
    sp.business_type,
    c.name,
    vr.status,
    vr.notes,
    vr.admin_notes,
    vr.reviewed_by,
    vr.reviewed_at,
    vr.created_at,
    vr.updated_at,
    sp.verified
  from public.verification_requests vr
  join public.supplier_profiles sp on sp.user_id = vr.supplier_id
  join public.profiles p on p.id = vr.supplier_id
  left join public.cities c on c.id = sp.city_id
  order by vr.created_at desc, vr.id desc;
end;
$$;

revoke all on function public.get_admin_verification_requests() from public, anon;
grant execute on function public.get_admin_verification_requests() to authenticated;

create or replace function public.admin_approve_verification(
  p_request_id uuid,
  p_admin_notes text default null
)
returns public.verification_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_request public.verification_requests;
  v_supplier public.supplier_profiles;
  v_notes text := nullif(btrim(coalesce(p_admin_notes, '')), '');
begin
  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'ملاحظات الإدارة طويلة جدًا.';
  end if;
  if v_admin_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;
  if not public.is_admin(v_admin_id) then
    raise exception 'لا تملك صلاحية تنفيذ هذه العملية.';
  end if;

  select * into v_request
  from public.verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'طلب التوثيق غير موجود.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'يمكن معالجة الطلبات المعلقة فقط.';
  end if;

  select * into v_supplier
  from public.supplier_profiles
  where user_id = v_request.supplier_id
  for update;

  if not found then
    raise exception 'ملف المورد غير موجود.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_request.supplier_id and role = 'supplier'
  ) then
    raise exception 'صاحب الطلب لم يعد حساب مورد.';
  end if;
  if v_supplier.verified then
    raise exception 'المورد موثّق بالفعل.';
  end if;

  update public.supplier_profiles
  set verified = true
  where user_id = v_request.supplier_id;

  update public.verification_requests
  set
    status = 'approved',
    reviewed_by = v_admin_id,
    reviewed_at = now(),
    admin_notes = v_notes
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.admin_approve_verification(uuid, text) from public, anon;
grant execute on function public.admin_approve_verification(uuid, text) to authenticated;

create or replace function public.admin_reject_verification(
  p_request_id uuid,
  p_admin_notes text default null
)
returns public.verification_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_request public.verification_requests;
  v_supplier public.supplier_profiles;
  v_notes text := nullif(btrim(coalesce(p_admin_notes, '')), '');
begin
  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'ملاحظات الإدارة طويلة جدًا.';
  end if;
  if v_admin_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;
  if not public.is_admin(v_admin_id) then
    raise exception 'لا تملك صلاحية تنفيذ هذه العملية.';
  end if;

  select * into v_request
  from public.verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'طلب التوثيق غير موجود.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'يمكن معالجة الطلبات المعلقة فقط.';
  end if;

  select * into v_supplier
  from public.supplier_profiles
  where user_id = v_request.supplier_id
  for update;

  if not found then
    raise exception 'ملف المورد غير موجود.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_request.supplier_id and role = 'supplier'
  ) then
    raise exception 'صاحب الطلب لم يعد حساب مورد.';
  end if;

  update public.supplier_profiles
  set verified = false
  where user_id = v_request.supplier_id;

  update public.verification_requests
  set
    status = 'rejected',
    reviewed_by = v_admin_id,
    reviewed_at = now(),
    admin_notes = v_notes
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.admin_reject_verification(uuid, text) from public, anon;
grant execute on function public.admin_reject_verification(uuid, text) to authenticated;

-- Only the database-side Admin RPC may change the verification flag.
-- Column privileges prevent ordinary supplier profile updates from touching it.

-- ===== END ORIGINAL: 20260920060000_supplier_verification.sql =====


-- ===== BEGIN ORIGINAL: 20260920070000_request_visibility_policy.sql =====
-- MATLOOB Step 21: database-enforced request visibility policy for FREE/PRO suppliers.
-- Adds only new policy/RLS/RPC behavior; previous migrations remain unchanged.

create table if not exists public.request_visibility_policy (
  id smallint primary key default 1,
  free_visibility_enabled boolean not null default true,
  pro_visibility_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_visibility_policy_singleton check (id = 1)
);

insert into public.request_visibility_policy (id, free_visibility_enabled, pro_visibility_enabled)
values (1, true, true)
on conflict (id) do nothing;

create or replace function public.set_request_visibility_policy_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists request_visibility_policy_set_updated_at on public.request_visibility_policy;
create trigger request_visibility_policy_set_updated_at
before update on public.request_visibility_policy
for each row
execute function public.set_request_visibility_policy_updated_at();

alter table public.request_visibility_policy enable row level security;
revoke all on public.request_visibility_policy from anon, authenticated;

-- Keep this table read-only to the database owner/service-side administration path.
-- No authenticated client receives direct SELECT/INSERT/UPDATE/DELETE privileges.

create or replace function public.can_supplier_view_request(p_request_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_role text;
  v_status text;
  v_is_pro boolean;
  v_free_enabled boolean;
  v_pro_enabled boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return false;
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id;

  if v_role <> 'supplier' then
    return false;
  end if;

  select r.status into v_status
  from public.requests r
  where r.id = p_request_id;

  if v_status is null or v_status <> 'open' then
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

revoke all on function public.can_supplier_view_request(uuid) from public, anon;
grant execute on function public.can_supplier_view_request(uuid) to authenticated;

-- Replace only the Step 17 request-search implementation through a new migration.
-- Requesters retain their existing search behavior. Suppliers are restricted in the
-- database to open requests allowed by the current FREE/PRO policy.
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
        and public.can_supplier_view_request(r.id)
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

-- Database-enforced read boundary. Requesters keep their existing access; selected
-- suppliers keep their Step 12 access. Other suppliers can read only open requests
-- permitted by can_supplier_view_request().
drop policy if exists "requests_select_open_authenticated" on public.requests;
create policy "requests_select_open_authenticated"
on public.requests
for select
to authenticated
using (
  requester_id = auth.uid()
  or (
    status = 'open'
    and public.can_supplier_view_request(id)
  )
  or exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = selected_offer_id
      and sp.user_id = auth.uid()
  )
);

-- ===== END ORIGINAL: 20260920070000_request_visibility_policy.sql =====


-- ===== BEGIN ORIGINAL: 20260920080000_supplier_request_matching.sql =====
-- MATLOOB Step 22: database-backed supplier/request matching.
-- Previous migrations are preserved. Matching is read-only and does not mutate
-- requests, offers, subscriptions, verification, or notifications.

-- The existing Step 18 helper intentionally permits checking only the current
-- authenticated user's PRO state. Matching may be requested by a request owner
-- or Admin and therefore needs a private, non-client-callable helper to evaluate
-- each matched supplier without exposing subscription data to the client.
create or replace function public.is_active_pro_supplier_for_matching(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    join public.profiles pr on pr.id = s.user_id
    where s.user_id = p_user_id
      and pr.role = 'supplier'
      and p.code = 'PRO'
      and p.is_active = true
      and s.status = 'active'
      and s.expires_at is not null
      and s.expires_at > now()
  );
$$;

revoke all on function public.is_active_pro_supplier_for_matching(uuid) from public, anon, authenticated;

-- supplier_categories is keyed by supplier_id first; this index makes the
-- category -> supplier side of matching efficient without loading relationships
-- into the frontend.
create index if not exists supplier_categories_category_id_idx
  on public.supplier_categories (category_id);

create index if not exists requests_category_id_idx
  on public.requests (category_id);

create index if not exists requests_city_id_idx
  on public.requests (city_id);

create index if not exists supplier_profiles_city_id_idx
  on public.supplier_profiles (city_id);

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

  select p.role
    into v_role
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

  -- A requester may inspect matching suppliers for their own request.
  -- Admins may inspect it for future administrative/read-only use.
  -- Suppliers may inspect only through the existing Step 21 visibility boundary.
  if v_role = 'requester' then
    if v_requester_id <> v_user_id then
      raise exception 'لا تملك صلاحية الوصول إلى مطابقة هذا الطلب.';
    end if;
  elsif v_role = 'supplier' then
    if not public.can_supplier_view_request(p_request_id) then
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

-- ===== END ORIGINAL: 20260920080000_supplier_request_matching.sql =====


-- ===== BEGIN ORIGINAL: 20260920090000_matching_request_notifications.sql =====
-- MATLOOB Step 23: notify matching suppliers when a new open request is created.
-- Previous migrations remain unchanged. Matching notifications are database-owned.

-- A notification already has related_request_id, so no new request reference column
-- is necessary. This partial unique index prevents duplicate matching notifications
-- for the same supplier/request pair while leaving existing notification types intact.
create unique index if not exists notifications_matching_request_unique_idx
  on public.notifications (user_id, related_request_id, type)
  where type = 'matching_request' and related_request_id is not null;

-- Extend the existing notification type constraint without rewriting Step 13.
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'new_offer',
      'offer_selected',
      'request_started',
      'request_completed',
      'request_cancelled',
      'matching_request'
    )
  );

-- Step 21's can_supplier_view_request() intentionally evaluates the current
-- authenticated user. A request INSERT trigger has no authenticated caller, so
-- notifications need a private equivalent that evaluates a specific supplier
-- against the same database visibility policy. It is not client callable.
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
  v_request_status text;
  v_supplier_role text;
  v_free_enabled boolean;
  v_pro_enabled boolean;
  v_is_pro boolean;
begin
  if p_request_id is null or p_supplier_id is null then
    return false;
  end if;

  select r.status
    into v_request_status
  from public.requests r
  where r.id = p_request_id;

  if v_request_status is distinct from 'open' then
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

revoke all on function public.can_supplier_view_request_for_matching(uuid, uuid) from public, anon, authenticated;

-- Keep the existing system notification helper as the sole database-owned insert
-- path, while making matching notification retries idempotent at the database
-- layer. Other notification types retain their existing behavior.
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
  on conflict (user_id, related_request_id, type)
    where type = 'matching_request' and related_request_id is not null
    do nothing
  returning * into v_notification;

  return v_notification;
end;
$$;

revoke all on function public.create_system_notification(uuid, text, text, text, uuid, uuid) from public, anon, authenticated;

-- New open request -> notify each currently visible supplier whose category
-- matches the request category. City, verification and PRO are matching/score
-- factors; category and visibility are the eligibility boundaries.
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
      and public.can_supplier_view_request_for_matching(new.id, sc.supplier_id)
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

-- Useful for the trigger's category lookup and the notification feed's request
-- reference. Existing Step 22 category index is preserved and reused.
create index if not exists notifications_request_id_idx
  on public.notifications (related_request_id);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id);

-- ===== END ORIGINAL: 20260920090000_matching_request_notifications.sql =====
