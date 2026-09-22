-- MATLOOB QA Round 11
-- Fix admin support ticket detail RPCs and make their result types explicit.

drop function if exists public.get_admin_support_ticket(uuid);
drop function if exists public.get_admin_support_messages(uuid);

create function public.get_admin_support_ticket(p_ticket_id uuid)
returns table(
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  subject text,
  category text,
  status text,
  priority text,
  created_at timestamptz,
  updated_at timestamptz,
  closed_at timestamptz
)
language plpgsql stable security definer set search_path=pg_catalog, public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية الوصول إلى تذكرة الدعم.' using errcode='42501';
  end if;

  return query
  select
    t.id::uuid,
    t.user_id::uuid,
    coalesce(p.full_name, '')::text,
    coalesce(u.email, '')::text,
    t.subject::text,
    t.category::text,
    t.status::text,
    t.priority::text,
    t.created_at::timestamptz,
    t.updated_at::timestamptz,
    t.closed_at::timestamptz
  from public.support_tickets t
  left join public.profiles p on p.id = t.user_id
  left join auth.users u on u.id = t.user_id
  where t.id = p_ticket_id;
end;
$$;

create function public.get_admin_support_messages(p_ticket_id uuid)
returns table(
  id uuid,
  ticket_id uuid,
  sender_id uuid,
  sender_name text,
  message text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path=pg_catalog, public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية الوصول إلى رسائل الدعم.' using errcode='42501';
  end if;

  return query
  select
    m.id::uuid,
    m.ticket_id::uuid,
    m.sender_id::uuid,
    coalesce(p.full_name, u.email, '')::text,
    m.message::text,
    m.created_at::timestamptz
  from public.support_messages m
  left join public.profiles p on p.id = m.sender_id
  left join auth.users u on u.id = m.sender_id
  where m.ticket_id = p_ticket_id
  order by m.created_at asc, m.id asc;
end;
$$;

revoke all on function public.get_admin_support_ticket(uuid) from public, anon;
grant execute on function public.get_admin_support_ticket(uuid) to authenticated;
revoke all on function public.get_admin_support_messages(uuid) from public, anon;
grant execute on function public.get_admin_support_messages(uuid) to authenticated;
