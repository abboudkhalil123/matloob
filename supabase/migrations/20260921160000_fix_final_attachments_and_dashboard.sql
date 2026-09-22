-- MATLOOB final QA fix
-- 1) Make the private attachment Storage policies deterministic and independent
--    from Storage metadata. The frontend already generates UUID/UUID.ext paths,
--    and the buckets themselves enforce MIME type + 10 MB size.
-- 2) The dashboard code avoids the nested offers(count) RLS path; no DB change
--    is needed for that part, but this migration also normalizes Storage rules.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('request-attachments', 'request-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('offer-attachments', 'offer-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove every existing policy that mentions either attachment bucket. This
-- also catches policies created under an older migration/name.
do $$
declare
  p record;
begin
  for p in
    select polname
    from pg_policy
    where polrelid = 'storage.objects'::regclass
      and (
        coalesce(pg_get_expr(polqual, polrelid), '') ilike '%request-attachments%'
        or coalesce(pg_get_expr(polqual, polrelid), '') ilike '%offer-attachments%'
        or coalesce(pg_get_expr(polwithcheck, polrelid), '') ilike '%request-attachments%'
        or coalesce(pg_get_expr(polwithcheck, polrelid), '') ilike '%offer-attachments%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', p.polname);
  end loop;
end $$;

-- Request attachments: only the request owner can upload/delete. Reads are
-- available to the requester, or to the supplier selected for the request.
create policy matloob_request_attachment_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-attachments'
  and exists (
    select 1
    from public.requests r
    where r.id::text = split_part(name, '/', 1)
      and r.requester_id = auth.uid()
  )
);

create policy matloob_request_attachment_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'request-attachments'
  and exists (
    select 1
    from public.request_attachments a
    join public.requests r on r.id = a.request_id
    where a.storage_path = name
      and (
        r.requester_id = auth.uid()
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

create policy matloob_request_attachment_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'request-attachments'
  and exists (
    select 1 from public.request_attachments a
    where a.storage_path = name
      and a.uploaded_by = auth.uid()
  )
);

-- Offer attachments: only the supplier who owns the offer can upload/delete;
-- the supplier and requester can read the stored file.
create policy matloob_offer_attachment_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'offer-attachments'
  and exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id::text = split_part(name, '/', 1)
      and sp.user_id = auth.uid()
  )
);

create policy matloob_offer_attachment_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'offer-attachments'
  and exists (
    select 1
    from public.offer_attachments a
    join public.offers o on o.id = a.offer_id
    join public.requests r on r.id = o.request_id
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where a.storage_path = name
      and (sp.user_id = auth.uid() or r.requester_id = auth.uid())
  )
);

create policy matloob_offer_attachment_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'offer-attachments'
  and exists (
    select 1 from public.offer_attachments a
    where a.storage_path = name
      and a.uploaded_by = auth.uid()
  )
);
