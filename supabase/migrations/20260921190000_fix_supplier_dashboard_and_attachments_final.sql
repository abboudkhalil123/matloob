-- Final QA: supplier dashboard data + deterministic attachment storage rules.

create or replace function public.get_supplier_dashboard_stats(p_supplier_id uuid)
returns table(offers bigint, selected bigint, in_progress bigint, completed bigint)
language sql stable security definer set search_path = public
as $$
  select
    count(*)::bigint as offers,
    count(*) filter (where r.status = 'supplier_selected')::bigint as selected,
    count(*) filter (where r.status = 'in_progress')::bigint as in_progress,
    count(*) filter (where r.status = 'completed')::bigint as completed
  from public.offers o
  join public.requests r on r.id = o.request_id
  join public.supplier_profiles sp on sp.id = o.supplier_id
  where sp.id = p_supplier_id and sp.user_id = auth.uid();
$$;

create or replace function public.get_supplier_latest_offers(p_supplier_id uuid, p_limit integer default 5)
returns table(
  id uuid, request_id uuid, request_title text, request_status text,
  price numeric, currency text, duration_value integer, duration_unit text, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select o.id, o.request_id, r.title, r.status, o.price, o.currency,
         o.duration_value, o.duration_unit, o.created_at
  from public.offers o
  join public.requests r on r.id = o.request_id
  join public.supplier_profiles sp on sp.id = o.supplier_id
  where sp.id = p_supplier_id and sp.user_id = auth.uid()
  order by o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 50));
$$;

revoke all on function public.get_supplier_dashboard_stats(uuid) from public, anon;
grant execute on function public.get_supplier_dashboard_stats(uuid) to authenticated;
revoke all on function public.get_supplier_latest_offers(uuid, integer) from public, anon;
grant execute on function public.get_supplier_latest_offers(uuid, integer) to authenticated;

-- The matching RPC returns supplier_profiles.user_id as supplier_id.
-- Keep the dashboard comparison on that same identity (handled in the frontend).

-- Reassert the two private buckets and remove every older attachment storage
-- INSERT policy that could conflict with the final deterministic rule.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
 ('request-attachments','request-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('offer-attachments','offer-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=excluded.allowed_mime_types;

do $$
declare p record;
begin
  for p in
    select polname from pg_policy
    where polrelid='storage.objects'::regclass
      and (
        coalesce(pg_get_expr(polqual, polrelid),'') ilike '%request-attachments%'
        or coalesce(pg_get_expr(polwithcheck, polrelid),'') ilike '%request-attachments%'
        or coalesce(pg_get_expr(polqual, polrelid),'') ilike '%offer-attachments%'
        or coalesce(pg_get_expr(polwithcheck, polrelid),'') ilike '%offer-attachments%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', p.polname);
  end loop;
end $$;

create policy matloob_attachment_storage_insert_final
on storage.objects for insert to authenticated
with check (bucket_id in ('request-attachments','offer-attachments'));

create policy matloob_attachment_storage_select_final
on storage.objects for select to authenticated
using (bucket_id in ('request-attachments','offer-attachments'));

create policy matloob_attachment_storage_delete_final
on storage.objects for delete to authenticated
using (bucket_id in ('request-attachments','offer-attachments'));
