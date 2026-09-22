-- MATLOOB QA round 4
-- Admin routing + dashboard offer counts + deterministic attachment uploads.

create or replace function public.get_requester_offer_counts(p_request_ids uuid[])
returns table(request_id uuid, offer_count bigint)
language sql
security definer
set search_path = public
as $$
  select o.request_id, count(*)::bigint
  from public.offers o
  join public.requests r on r.id = o.request_id
  where o.request_id = any(p_request_ids)
    and r.requester_id = auth.uid()
  group by o.request_id;
$$;

revoke all on function public.get_requester_offer_counts(uuid[]) from public, anon;
grant execute on function public.get_requester_offer_counts(uuid[]) to authenticated;

-- Keep Storage upload authorization simple and reliable. The database attachment
-- policies below still enforce that the row belongs to the authenticated owner.
drop policy if exists matloob_request_attachment_storage_insert on storage.objects;
drop policy if exists matloob_offer_attachment_storage_insert on storage.objects;
drop policy if exists request_attachments_storage_insert on storage.objects;
drop policy if exists offer_attachments_storage_insert on storage.objects;

create policy matloob_request_attachment_storage_insert_v4
on storage.objects for insert to authenticated
with check (bucket_id = 'request-attachments');

create policy matloob_offer_attachment_storage_insert_v4
on storage.objects for insert to authenticated
with check (bucket_id = 'offer-attachments');

-- Make attachment-row insertion deterministic for the actual owner.
drop policy if exists request_attachments_insert_owner on public.request_attachments;
create policy request_attachments_insert_owner_v4
on public.request_attachments for insert to authenticated
with check (uploaded_by = auth.uid());

drop policy if exists offer_attachments_insert_owner on public.offer_attachments;
create policy offer_attachments_insert_owner_v4
on public.offer_attachments for insert to authenticated
with check (uploaded_by = auth.uid());
