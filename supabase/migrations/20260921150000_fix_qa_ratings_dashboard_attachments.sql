-- MATLOOB QA round 2
-- Apply after 20260921140000_batch_qa_fixes.sql.

-- The frontend uses supplier_profiles.id in /suppliers/:id, while reviews store
-- the supplier user's profiles.id. No DB change is required for ratings, but
-- this migration makes the storage upload rules intentionally simple and robust.

-- Keep the buckets private and consistent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('request-attachments', 'request-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('offer-attachments', 'offer-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove the previous upload rules so older/duplicate policy variants cannot
-- block an otherwise valid upload.
drop policy if exists request_attachments_storage_insert on storage.objects;
drop policy if exists request_attachments_storage_select on storage.objects;
drop policy if exists request_attachments_storage_update on storage.objects;
drop policy if exists request_attachments_storage_delete on storage.objects;
drop policy if exists offer_attachments_storage_insert on storage.objects;
drop policy if exists offer_attachments_storage_select on storage.objects;
drop policy if exists offer_attachments_storage_update on storage.objects;
drop policy if exists offer_attachments_storage_delete on storage.objects;

create policy request_attachments_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp|pdf)$'
  and exists (
    select 1 from public.requests r
    where r.id = split_part(name, '/', 1)::uuid
      and r.requester_id = auth.uid()
  )
);

create policy request_attachments_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'request-attachments'
  and exists (
    select 1
    from public.request_attachments a
    join public.requests r on r.id = a.request_id
    where a.storage_path = name
      and (r.status = 'open' or r.requester_id = auth.uid() or exists (
        select 1 from public.offers o
        join public.supplier_profiles sp on sp.id = o.supplier_id
        where o.id = r.selected_offer_id and sp.user_id = auth.uid()
      ))
  )
);

create policy request_attachments_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'request-attachments'
  and exists (
    select 1 from public.request_attachments a
    where a.storage_path = name and a.uploaded_by = auth.uid()
  )
);

create policy offer_attachments_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'offer-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp|pdf)$'
  and exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = split_part(name, '/', 1)::uuid
      and sp.user_id = auth.uid()
  )
);

create policy offer_attachments_storage_select
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

create policy offer_attachments_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'offer-attachments'
  and exists (
    select 1 from public.offer_attachments a
    where a.storage_path = name and a.uploaded_by = auth.uid()
  )
);
