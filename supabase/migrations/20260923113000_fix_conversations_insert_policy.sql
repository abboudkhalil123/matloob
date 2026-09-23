-- =====================================================
-- Fix conversations INSERT policy
-- =====================================================

-- حذف السياسات القديمة
drop policy if exists conversations_insert_requester
on public.conversations;

drop policy if exists conversations_insert_supplier
on public.conversations;

drop policy if exists conversations_insert_participant
on public.conversations;

-- حذف الدالة القديمة إذا كانت موجودة
drop function if exists public.can_create_conversation(uuid, uuid);

-- =====================================================
-- دالة التحقق
-- =====================================================

create function public.can_create_conversation(
    p_request_id uuid,
    p_offer_id uuid
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
                r.requester_id = auth.uid()
                or exists (
                    select 1
                    from public.supplier_profiles sp
                    where sp.id = o.supplier_id
                      and sp.user_id = auth.uid()
                )
          )
    );
$$;

grant execute
on function public.can_create_conversation(uuid, uuid)
to authenticated;

-- =====================================================
-- سياسة INSERT موحدة
-- =====================================================

create policy conversations_insert_participant
on public.conversations
for insert
to authenticated
with check (
    public.can_create_conversation(
        request_id,
        offer_id
    )
);