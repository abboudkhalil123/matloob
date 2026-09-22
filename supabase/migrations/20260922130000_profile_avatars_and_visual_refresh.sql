-- MATLOOB: profile avatars for requesters and suppliers + avatar storage policies
alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
on storage.objects for select
to public
using (bucket_id = 'avatars');

drop policy if exists avatars_authenticated_insert on storage.objects;
create policy avatars_authenticated_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_authenticated_update on storage.objects;
create policy avatars_authenticated_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_authenticated_delete on storage.objects;
create policy avatars_authenticated_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid,
  full_name text,
  role text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, p.avatar_url
  from public.profiles p
  where p.id = p_user_id and p.is_active = true;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated;
