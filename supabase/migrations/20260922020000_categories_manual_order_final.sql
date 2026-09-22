-- MATLOOB: final main-category list + manual ordering.
-- The order is intentionally curated for the Syrian market and must not be alphabetical.

alter table public.categories
  add column if not exists sort_order integer not null default 9999;

-- Keep exactly the main categories approved for the current MATLOOB release.
-- Existing legacy categories are kept in the database for historical references,
-- but are deactivated so they no longer appear in new requests/supplier forms.
with desired(name, slug, sort_order) as (
  values
    ('الأزياء والموضة', 'fashion', 10),
    ('الطباعة والدعاية والإعلان', 'printing-advertising', 20),
    ('التصميم والتسويق', 'design-marketing', 30),
    ('الكهربائيات والإلكترونيات', 'electronics-electrical', 40),
    ('الأثاث والديكور', 'furniture-decor', 50),
    ('الصيانة والخدمات المنزلية', 'maintenance-home-services', 60),
    ('الخدمات والأعمال', 'business-services', 70),
    ('السيارات والنقل', 'automotive-transport', 80),
    ('الآلات والمعدات', 'machinery-equipment', 90),
    ('الجمال والعناية الشخصية', 'beauty-personal-care', 100),
    ('التعليم والتدريب', 'education-training', 110),
    ('الهدايا والعطور', 'gifts-perfumes', 120),
    ('أخرى', 'other', 9990)
)
insert into public.categories (name, slug, sort_order, is_active)
select name, slug, sort_order, true
from desired
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;

update public.categories c
set is_active = false
where c.slug not in (
  'fashion',
  'printing-advertising',
  'design-marketing',
  'electronics-electrical',
  'furniture-decor',
  'maintenance-home-services',
  'business-services',
  'automotive-transport',
  'machinery-equipment',
  'beauty-personal-care',
  'education-training',
  'gifts-perfumes',
  'other'
);

-- Public category reads must use the manual order.
drop function if exists public.get_admin_categories(text, boolean, integer, integer);

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
  sort_order integer,
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
      c.sort_order,
      (select count(*) from public.requests r where r.category_id = c.id) as request_count,
      (select count(*) from public.supplier_categories sc where sc.category_id = c.id) as supplier_count
    from public.categories c
    where (v_search is null or c.name ilike '%' || v_search || '%' or c.slug ilike '%' || v_search || '%')
      and (p_is_active is null or c.is_active = p_is_active)
  )
  select r.*, (r.request_count + r.supplier_count) as usage_count, count(*) over() as total_count
  from rows r
  order by r.sort_order asc, r.id asc
  offset (v_page - 1) * v_page_size
  limit v_page_size;
end;
$$;

-- New categories created by an administrator go to the end automatically.
drop function if exists public.create_admin_category(text, text);

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
  v_sort_order integer;
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

  select coalesce(max(sort_order), 0) + 10 into v_sort_order
  from public.categories;

  insert into public.categories (name, slug, sort_order, is_active)
  values (v_name, v_slug, v_sort_order, true)
  returning * into v_category;
  return v_category;
exception
  when unique_violation then
    raise exception 'اسم التصنيف أو slug مستخدم مسبقًا.' using errcode = '23505';
end;
$$;

-- Existing category edits do not change the curated order.
drop function if exists public.update_admin_category(uuid, text, text);

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

revoke all on function public.get_admin_categories(text, boolean, integer, integer) from public, anon;
grant execute on function public.get_admin_categories(text, boolean, integer, integer) to authenticated;
revoke all on function public.create_admin_category(text, text) from public, anon;
grant execute on function public.create_admin_category(text, text) to authenticated;
revoke all on function public.update_admin_category(uuid, text, text) from public, anon;
grant execute on function public.update_admin_category(uuid, text, text) to authenticated;
