-- MATLOOB QA: make request attachments visible to suppliers while the request is open.
-- The database row policy already allows open requests, but the private Storage
-- SELECT policy previously allowed only the requester or the selected supplier.

drop policy if exists matloob_request_attachment_storage_select on storage.objects;

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
