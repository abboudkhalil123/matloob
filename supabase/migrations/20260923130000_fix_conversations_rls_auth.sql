-- =====================================================
-- Fix conversations RLS auth context
-- =====================================================

drop policy if exists conversations_insert_participant
on public.conversations;

drop function if exists public.can_create_conversation(uuid, uuid);

create function public.can_create_conversation(
    p_request_id uuid,
    p_offer_id uuid,
    p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1
        from public.requests r
        join public.offers o
            on o.id = p_offer_id
           and o.request_id = r.id
        where r.id = p_request_id
          and r.selected_offer_id = p_offer_id
          and (
                r.requester_id = p_user_id
                or exists (
                    select 1
                    from public.supplier_profiles sp
                    where sp.id = o.supplier_id
                      and sp.user_id = p_user_id
                )
          )
    );
$$;

grant execute
on function public.can_create_conversation(uuid, uuid, uuid)
to authenticated;

create policy conversations_insert_participant
on public.conversations
for insert
to authenticated
with check (
    public.can_create_conversation(
        request_id,
        offer_id,
        (select auth.uid())
    )
);