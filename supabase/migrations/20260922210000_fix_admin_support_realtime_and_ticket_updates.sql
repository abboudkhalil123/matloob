-- MATLOOB: fix admin support realtime delivery and live ticket status updates.
-- Additive only. No existing data is deleted or modified.

alter table public.support_tickets replica identity full;

-- Admins need a SELECT policy for Realtime authorization on support tickets.
drop policy if exists support_tickets_select_admin on public.support_tickets;
create policy support_tickets_select_admin
on public.support_tickets
for select
 to authenticated
using (public.is_admin(auth.uid()));

-- Ensure support tickets are part of the Realtime publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end $$;
