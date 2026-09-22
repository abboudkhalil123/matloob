drop function if exists public.get_admin_support_tickets(text,text,text,text,integer,integer);

create function public.get_admin_support_tickets(
  p_status text default null,
  p_priority text default null,
  p_category text default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 12
)
returns table(
  id uuid, user_id uuid, user_name text, user_email text, subject text, category text, status text, priority text,
  created_at timestamptz, updated_at timestamptz, closed_at timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  v_page_size integer := greatest(1, least(coalesce(p_page_size,12),50));
  v_page integer := greatest(coalesce(p_page,1),1);
begin
  if not public.is_admin(auth.uid()) then raise exception 'not authorized'; end if;
  return query
  select t.id::uuid,
         t.user_id::uuid,
         coalesce(p.full_name,'')::text,
         coalesce(u.email,'')::text,
         t.subject::text,
         t.category::text,
         t.status::text,
         t.priority::text,
         t.created_at::timestamptz,
         t.updated_at::timestamptz,
         t.closed_at::timestamptz,
         count(*) over()::bigint as total_count
  from public.support_tickets t
  left join public.profiles p on p.id=t.user_id
  left join auth.users u on u.id=t.user_id
  where (nullif(p_status,'') is null or t.status=p_status)
    and (nullif(p_priority,'') is null or t.priority=p_priority)
    and (nullif(p_category,'') is null or t.category=p_category)
    and (nullif(p_search,'') is null
      or t.subject ilike '%'||btrim(p_search)||'%'
      or coalesce(p.full_name,'') ilike '%'||btrim(p_search)||'%'
      or coalesce(u.email,'') ilike '%'||btrim(p_search)||'%')
  order by t.updated_at desc,t.id desc
  limit v_page_size offset (v_page-1)*v_page_size;
end; $$;
revoke all on function public.get_admin_support_tickets(text,text,text,text,integer,integer) from public, anon;
grant execute on function public.get_admin_support_tickets(text,text,text,text,integer,integer) to authenticated;

drop function if exists public.get_admin_support_summary();

create function public.get_admin_support_summary()
returns table(
  open_tickets bigint,
  in_progress_tickets bigint,
  waiting_user_tickets bigint,
  urgent_tickets bigint
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'لا تملك صلاحية الوصول.' using errcode='42501';
  end if;

  return query
  select
    count(*) filter (where status='open')::bigint,
    count(*) filter (where status='in_progress')::bigint,
    count(*) filter (where status='waiting_user')::bigint,
    count(*) filter (where priority='urgent' and status not in ('closed','resolved'))::bigint
  from public.support_tickets;
end; $$;
revoke all on function public.get_admin_support_summary() from public, anon;
grant execute on function public.get_admin_support_summary() to authenticated;
