-- MATLOOB: notify the other conversation participant when a new message is sent.
-- Apply this manually in Supabase SQL Editor because the existing migration history
-- is not currently safe to replay with `supabase db push`.

alter table public.notifications
  add column if not exists related_conversation_id uuid null
  references public.conversations(id) on delete cascade;

create index if not exists notifications_conversation_id_idx
  on public.notifications(related_conversation_id);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'new_offer',
      'offer_selected',
      'request_started',
      'request_completed',
      'request_cancelled',
      'matching_request',
      'support_reply',
      'support_status_changed',
      'new_message'
    )
  );

create or replace function public.notify_new_conversation_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_id uuid;
  v_offer_id uuid;
  v_requester_id uuid;
  v_supplier_user_id uuid;
  v_recipient_id uuid;
  v_request_title text;
begin
  select
    c.request_id,
    c.offer_id,
    r.requester_id,
    r.title,
    sp.user_id
  into
    v_request_id,
    v_offer_id,
    v_requester_id,
    v_request_title,
    v_supplier_user_id
  from public.conversations c
  join public.requests r on r.id = c.request_id
  join public.offers o on o.id = c.offer_id and o.request_id = c.request_id
  join public.supplier_profiles sp on sp.id = o.supplier_id
  where c.id = new.conversation_id;

  if v_request_id is null then
    return new;
  end if;

  if new.sender_id = v_requester_id then
    v_recipient_id := v_supplier_user_id;
  elsif new.sender_id = v_supplier_user_id then
    v_recipient_id := v_requester_id;
  else
    return new;
  end if;

  if v_recipient_id is null then
    return new;
  end if;

  insert into public.notifications (
    user_id,
    title,
    message,
    type,
    related_request_id,
    related_offer_id,
    related_conversation_id
  )
  values (
    v_recipient_id,
    'رسالة جديدة',
    'لديك رسالة جديدة بخصوص الطلب: ' || coalesce(v_request_title, 'طلبك'),
    'new_message',
    v_request_id,
    v_offer_id,
    new.conversation_id
  );

  return new;
end;
$$;

drop trigger if exists conversation_messages_notification on public.conversation_messages;
create trigger conversation_messages_notification
after insert on public.conversation_messages
for each row
execute function public.notify_new_conversation_message();

revoke all on function public.notify_new_conversation_message() from public;
revoke all on function public.notify_new_conversation_message() from authenticated;
