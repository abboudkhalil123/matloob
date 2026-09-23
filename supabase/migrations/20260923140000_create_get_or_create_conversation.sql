```sql
-- =====================================================
-- Create secure RPC for getting/creating conversations
-- =====================================================

drop function if exists public.get_or_create_conversation(uuid);

create function public.get_or_create_conversation(
    p_offer_id uuid
)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_user_id uuid;
    v_request_id uuid;
    v_conversation public.conversations;
begin
    -- Current authenticated user
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    -- Get the request belonging to the selected offer
    select
        o.request_id
    into
        v_request_id
    from public.offers o
    join public.requests r
        on r.id = o.request_id
    where o.id = p_offer_id
      and r.selected_offer_id = o.id
      and (
          r.requester_id = v_user_id
          or exists (
              select 1
              from public.supplier_profiles sp
              where sp.id = o.supplier_id
                and sp.user_id = v_user_id
          )
      );

    -- User must be the requester or the selected supplier
    if v_request_id is null then
        raise exception 'You are not allowed to access this conversation';
    end if;

    -- Return existing conversation if it already exists
    select *
    into v_conversation
    from public.conversations
    where offer_id = p_offer_id
    limit 1;

    if found then
        return v_conversation;
    end if;

    -- Create the conversation
    insert into public.conversations (
        request_id,
        offer_id
    )
    values (
        v_request_id,
        p_offer_id
    )
    returning *
    into v_conversation;

    return v_conversation;
end;
$function$;

grant execute
on function public.get_or_create_conversation(uuid)
to authenticated;
```
