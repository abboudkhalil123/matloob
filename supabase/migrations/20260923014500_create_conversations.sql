-- MATLOOB - Conversations Database
-- Run this file in Supabase SQL Editor

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_offer_unique unique (offer_id)
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  constraint conversation_messages_message_not_empty check (length(trim(message)) > 0),
  constraint conversation_messages_message_length check (length(message) <= 5000)
);

create index if not exists conversations_request_id_idx
  on public.conversations(request_id);
create index if not exists conversations_offer_id_idx
  on public.conversations(offer_id);
create index if not exists conversation_messages_conversation_id_idx
  on public.conversation_messages(conversation_id);
create index if not exists conversation_messages_created_at_idx
  on public.conversation_messages(created_at);
create index if not exists conversation_messages_sender_id_idx
  on public.conversation_messages(sender_id);

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversations c
    join public.requests r on r.id = c.request_id
    join public.offers o on o.id = c.offer_id and o.request_id = c.request_id
    join public.supplier_profiles sp on sp.id = o.supplier_id
    where c.id = p_conversation_id
      and (r.requester_id = auth.uid() or sp.user_id = auth.uid())
  );
$$;

revoke all on function public.is_conversation_participant(uuid) from public;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

create or replace function public.validate_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid;
  v_selected_offer_id uuid;
  v_offer_request_id uuid;
begin
  select r.requester_id, r.selected_offer_id
  into v_requester_id, v_selected_offer_id
  from public.requests r
  where r.id = new.request_id;

  if v_requester_id is null then
    raise exception 'الطلب غير موجود';
  end if;

  if v_selected_offer_id is null then
    raise exception 'لا يمكن إنشاء محادثة قبل اختيار عرض';
  end if;

  if v_selected_offer_id <> new.offer_id then
    raise exception 'المحادثة يجب أن ترتبط بالعرض المقبول';
  end if;

  select o.request_id into v_offer_request_id
  from public.offers o
  where o.id = new.offer_id;

  if v_offer_request_id is null then
    raise exception 'العرض غير موجود';
  end if;

  if v_offer_request_id <> new.request_id then
    raise exception 'العرض لا ينتمي إلى هذا الطلب';
  end if;

  if not exists (
    select 1
    from public.supplier_profiles sp
    join public.offers o on o.supplier_id = sp.id
    where o.id = new.offer_id
  ) then
    raise exception 'المورد المرتبط بالعرض غير موجود';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_conversation_trigger on public.conversations;
create trigger validate_conversation_trigger
before insert or update on public.conversations
for each row execute function public.validate_conversation();

create or replace function public.set_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists conversation_message_updated_at_trigger on public.conversation_messages;
create trigger conversation_message_updated_at_trigger
after insert on public.conversation_messages
for each row execute function public.set_conversation_updated_at();

create or replace function public.prevent_message_content_change()
returns trigger
language plpgsql
as $$
begin
  if new.message <> old.message
     or new.sender_id <> old.sender_id
     or new.conversation_id <> old.conversation_id
     or new.created_at <> old.created_at then
    raise exception 'لا يمكن تعديل الرسالة بعد إرسالها';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_message_content_change_trigger on public.conversation_messages;
create trigger prevent_message_content_change_trigger
before update on public.conversation_messages
for each row execute function public.prevent_message_content_change();

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists conversations_select_participants on public.conversations;
create policy conversations_select_participants
on public.conversations
for select to authenticated
using (public.is_conversation_participant(id));

drop policy if exists conversations_insert_requester on public.conversations;
create policy conversations_insert_requester
on public.conversations
for insert to authenticated
with check (
  exists (
    select 1
    from public.requests r
    where r.id = request_id
      and r.requester_id = auth.uid()
      and r.selected_offer_id = offer_id
  )
);

drop policy if exists conversations_insert_supplier on public.conversations;
create policy conversations_insert_supplier
on public.conversations
for insert to authenticated
with check (
  exists (
    select 1
    from public.offers o
    join public.supplier_profiles sp on sp.id = o.supplier_id
    join public.requests r on r.id = o.request_id
    where o.id = offer_id
      and o.request_id = request_id
      and r.selected_offer_id = o.id
      and sp.user_id = auth.uid()
  )
);

drop policy if exists conversation_messages_select_participants on public.conversation_messages;
create policy conversation_messages_select_participants
on public.conversation_messages
for select to authenticated
using (public.is_conversation_participant(conversation_id));

drop policy if exists conversation_messages_insert_participants on public.conversation_messages;
create policy conversation_messages_insert_participants
on public.conversation_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
);

drop policy if exists conversation_messages_update_participants on public.conversation_messages;
create policy conversation_messages_update_participants
on public.conversation_messages
for update to authenticated
using (public.is_conversation_participant(conversation_id))
with check (public.is_conversation_participant(conversation_id));

drop policy if exists conversations_update_participants on public.conversations;
drop policy if exists conversations_delete_participants on public.conversations;
drop policy if exists conversation_messages_delete_participants on public.conversation_messages;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_messages'
  ) then
    alter publication supabase_realtime
      add table public.conversation_messages;
  end if;
end
$$;
