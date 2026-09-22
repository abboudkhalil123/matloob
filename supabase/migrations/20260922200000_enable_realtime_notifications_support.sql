-- MATLOOB: enable realtime delivery for in-app notifications and support chat.
-- This migration is additive only. It does not delete or alter existing data.

alter table public.notifications replica identity full;
alter table public.support_messages replica identity full;

-- Admins already access support messages through security-definer RPCs.
-- This SELECT policy also allows Supabase Realtime to deliver message INSERTs
-- to authenticated admin sessions without exposing messages to normal users.
drop policy if exists support_messages_select_admin on public.support_messages;
create policy support_messages_select_admin
on public.support_messages
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Add the two tables to Supabase Realtime only when they are not already present.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;
