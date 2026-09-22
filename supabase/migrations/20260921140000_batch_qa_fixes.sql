-- MATLOOB QA batch fixes
-- Apply AFTER all existing migrations, including the PRO matching fix.

-- 1) Customer must also receive a notification when their offer is selected.
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
      perform public.create_system_notification(v_supplier_user_id, 'تم اختيار عرضك', 'تم اختيار عرضك للطلب: ' || new.title, 'offer_selected', new.id, new.selected_offer_id);
    end if;

    perform public.create_system_notification(new.requester_id, 'تم اختيار العرض', 'تم اختيار العرض للطلب: ' || new.title, 'offer_selected', new.id, new.selected_offer_id);
  end if;
  return new;
end;
$$;

revoke all on function public.notify_offer_selected() from public, anon, authenticated;

-- 2) Lifecycle notifications: always notify the other participant, while keeping
-- the existing actor check for the authenticated workflow RPCs.
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
  if new.status is not distinct from old.status then return new; end if;
  if new.status not in ('in_progress', 'completed', 'cancelled') then return new; end if;

  if new.selected_offer_id is not null then
    select sp.user_id into v_supplier_user_id
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = new.selected_offer_id and o.request_id = new.id;
  end if;

  if new.status = 'cancelled' and old.status = 'open' then return new; end if;
  if v_supplier_user_id is null then return new; end if;

  if auth.uid() = new.requester_id then
    v_recipient_id := v_supplier_user_id;
  elsif auth.uid() = v_supplier_user_id then
    v_recipient_id := new.requester_id;
  else
    return new;
  end if;

  if new.status = 'in_progress' then
    v_title := 'بدأ تنفيذ الطلب'; v_message := 'بدأ تنفيذ الطلب: ' || new.title; v_type := 'request_started';
  elsif new.status = 'completed' then
    v_title := 'تم إكمال الطلب'; v_message := 'تم إكمال الطلب: ' || new.title; v_type := 'request_completed';
  else
    v_title := 'تم إلغاء الطلب'; v_message := 'تم إلغاء الطلب: ' || new.title; v_type := 'request_cancelled';
  end if;

  perform public.create_system_notification(v_recipient_id, v_title, v_message, v_type, new.id, new.selected_offer_id);
  return new;
end;
$$;

revoke all on function public.notify_request_status_change() from public, anon, authenticated;

-- 3) Rebuild attachment policies idempotently. This protects the upload flow
-- even if an earlier policy was partially applied or duplicated during setup.
drop policy if exists request_attachments_insert_owner on public.request_attachments;
drop policy if exists request_attachments_select_visible_request on public.request_attachments;
drop policy if exists request_attachments_delete_owner on public.request_attachments;
drop policy if exists offer_attachments_insert_owner on public.offer_attachments;
drop policy if exists offer_attachments_select_visible_offer on public.offer_attachments;
drop policy if exists offer_attachments_delete_owner on public.offer_attachments;

create policy request_attachments_insert_owner
on public.request_attachments for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (select 1 from public.requests r where r.id = request_attachments.request_id and r.requester_id = auth.uid())
);

create policy request_attachments_select_visible_request
on public.request_attachments for select to authenticated
using (
  exists (
    select 1 from public.requests r
    where r.id = request_attachments.request_id
      and (r.status = 'open' or r.requester_id = auth.uid() or exists (
        select 1 from public.offers o
        join public.supplier_profiles sp on sp.id = o.supplier_id
        where o.id = r.selected_offer_id and sp.user_id = auth.uid()
      ))
  )
);

create policy request_attachments_delete_owner
on public.request_attachments for delete to authenticated
using (
  uploaded_by = auth.uid()
  and exists (select 1 from public.requests r where r.id = request_attachments.request_id and r.requester_id = auth.uid())
);

create policy offer_attachments_insert_owner
on public.offer_attachments for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = offer_attachments.offer_id and sp.user_id = auth.uid()
  )
);

create policy offer_attachments_select_visible_offer
on public.offer_attachments for select to authenticated
using (
  exists (
    select 1 from public.offers o
    join public.requests r on r.id = o.request_id
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = offer_attachments.offer_id and (sp.user_id = auth.uid() or r.requester_id = auth.uid())
  )
);

create policy offer_attachments_delete_owner
on public.offer_attachments for delete to authenticated
using (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where o.id = offer_attachments.offer_id and sp.user_id = auth.uid()
  )
);

-- Recreate Storage policies with explicit names and ownership checks.
drop policy if exists request_attachments_storage_insert on storage.objects;
drop policy if exists request_attachments_storage_select on storage.objects;
drop policy if exists request_attachments_storage_update on storage.objects;
drop policy if exists request_attachments_storage_delete on storage.objects;
drop policy if exists offer_attachments_storage_insert on storage.objects;
drop policy if exists offer_attachments_storage_select on storage.objects;
drop policy if exists offer_attachments_storage_update on storage.objects;
drop policy if exists offer_attachments_storage_delete on storage.objects;

create policy request_attachments_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'request-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and exists (select 1 from public.requests r where r.id::text = split_part(name,'/',1) and r.requester_id = auth.uid())
);
create policy request_attachments_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'request-attachments'
  and exists (select 1 from public.request_attachments a join public.requests r on r.id=a.request_id where a.storage_path=name and (r.status='open' or r.requester_id=auth.uid() or exists (select 1 from public.offers o join public.supplier_profiles sp on sp.id=o.supplier_id where o.id=r.selected_offer_id and sp.user_id=auth.uid())))
);
create policy request_attachments_storage_update on storage.objects for update to authenticated using (
  bucket_id='request-attachments' and exists (select 1 from public.requests r where r.id=split_part(name,'/',1)::uuid and r.requester_id=auth.uid())
) with check (
  bucket_id='request-attachments' and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$' and exists (select 1 from public.requests r where r.id=split_part(name,'/',1)::uuid and r.requester_id=auth.uid())
);
create policy request_attachments_storage_delete on storage.objects for delete to authenticated using (
  bucket_id='request-attachments' and exists (select 1 from public.request_attachments a where a.storage_path=name and a.uploaded_by=auth.uid())
);

create policy offer_attachments_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='offer-attachments'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  and exists (select 1 from public.offers o join public.supplier_profiles sp on sp.id=o.supplier_id where o.id::text=split_part(name,'/',1) and sp.user_id=auth.uid())
);
create policy offer_attachments_storage_select on storage.objects for select to authenticated using (
  bucket_id='offer-attachments'
  and exists (select 1 from public.offer_attachments a join public.offers o on o.id=a.offer_id join public.requests r on r.id=o.request_id join public.supplier_profiles sp on sp.id=o.supplier_id where a.storage_path=name and (sp.user_id=auth.uid() or r.requester_id=auth.uid()))
);
create policy offer_attachments_storage_update on storage.objects for update to authenticated using (
  bucket_id='offer-attachments' and exists (select 1 from public.offer_attachments a join public.offers o on o.id=a.offer_id join public.supplier_profiles sp on sp.id=o.supplier_id where a.storage_path=name and sp.user_id=auth.uid())
) with check (
  bucket_id='offer-attachments' and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$' and exists (select 1 from public.offer_attachments a join public.offers o on o.id=a.offer_id join public.supplier_profiles sp on sp.id=o.supplier_id where a.storage_path=name and sp.user_id=auth.uid())
);
create policy offer_attachments_storage_delete on storage.objects for delete to authenticated using (
  bucket_id='offer-attachments' and exists (select 1 from public.offer_attachments a where a.storage_path=name and a.uploaded_by=auth.uid())
);
