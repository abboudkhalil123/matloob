-- MATLOOB QA round 5
-- 1) Everyone uses /dashboard. Admin-only access remains available from the homepage footer.
-- 2) Attachment rows are registered through SECURITY DEFINER functions after Storage upload,
--    eliminating client-side RLS ambiguity while preserving strict ownership checks.

create or replace function public.register_request_attachment(
  p_request_id uuid, p_uploaded_by uuid, p_storage_path text,
  p_file_name text, p_file_type text, p_file_size bigint
)
returns public.request_attachments
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.request_attachments;
begin
  if auth.uid() is null or auth.uid() <> p_uploaded_by then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.requests r where r.id=p_request_id and r.requester_id=auth.uid()) then raise exception 'REQUEST_OWNER_REQUIRED'; end if;
  if p_file_size <= 0 or p_file_size > 10485760 then raise exception 'FILE_SIZE_INVALID'; end if;
  if lower(p_file_type) not in ('image/jpeg','image/png','image/webp','application/pdf') then raise exception 'FILE_TYPE_INVALID'; end if;
  insert into public.request_attachments(request_id,uploaded_by,storage_path,file_name,file_type,file_size)
  values(p_request_id,p_uploaded_by,p_storage_path,p_file_name,p_file_type,p_file_size)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.register_offer_attachment(
  p_offer_id uuid, p_uploaded_by uuid, p_storage_path text,
  p_file_name text, p_file_type text, p_file_size bigint
)
returns public.offer_attachments
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.offer_attachments;
begin
  if auth.uid() is null or auth.uid() <> p_uploaded_by then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.offers o join public.supplier_profiles sp on sp.id=o.supplier_id
    where o.id=p_offer_id and sp.user_id=auth.uid()
  ) then raise exception 'OFFER_OWNER_REQUIRED'; end if;
  if p_file_size <= 0 or p_file_size > 10485760 then raise exception 'FILE_SIZE_INVALID'; end if;
  if lower(p_file_type) not in ('image/jpeg','image/png','image/webp','application/pdf') then raise exception 'FILE_TYPE_INVALID'; end if;
  insert into public.offer_attachments(offer_id,uploaded_by,storage_path,file_name,file_type,file_size)
  values(p_offer_id,p_uploaded_by,p_storage_path,p_file_name,p_file_type,p_file_size)
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.register_request_attachment(uuid,uuid,text,text,text,bigint) from public, anon;
revoke all on function public.register_offer_attachment(uuid,uuid,text,text,text,bigint) from public, anon;
grant execute on function public.register_request_attachment(uuid,uuid,text,text,text,bigint) to authenticated;
grant execute on function public.register_offer_attachment(uuid,uuid,text,text,text,bigint) to authenticated;

-- Storage insert is intentionally limited to authenticated users and the two dedicated buckets.
drop policy if exists matloob_attachment_storage_insert_v5 on storage.objects;
create policy matloob_attachment_storage_insert_v5
on storage.objects for insert to authenticated
with check (bucket_id in ('request-attachments','offer-attachments'));
