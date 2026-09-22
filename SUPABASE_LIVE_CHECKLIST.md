# MATLOOB — Supabase Live Checklist (Step 30)

## 1. Migration order

Apply the migrations from `supabase/migrations/` in filename/timestamp order, from:

`20260919190000_create_profiles.sql`

to:

`20260920180000_fix_requests_offers_rls_recursion.sql`

Do not skip any migration. The three post-audit RLS recursion fixes (`20260920160000`, `20260920170000`, `20260920180000`) are required and must also be applied in order.

## 2. Environment

Configure these application variables in the deployment environment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use the Supabase project URL and its public anon/publishable client key only. Never put a service-role key in the frontend.

## 3. Admin setup

After the initial profile exists, add the first administrator directly in the Supabase SQL Editor by inserting the authenticated user's UUID into `public.admin_users`.

Example shape (replace the placeholder manually in the SQL Editor; do not put it in application code):

```sql
insert into public.admin_users (user_id)
values ('<AUTH_USER_UUID>')
on conflict (user_id) do nothing;
```

Verify that the user is present in `admin_users` and that `public.is_admin(auth.uid())` returns true when called from that authenticated session.

## 4. RLS tests

Test with four contexts:

- Anonymous
- Requester
- Supplier
- Admin

Verify that users cannot read or modify records belonging to other users, while Admin RPCs work only for `admin_users` members.

## 5. Core workflow tests

1. Create requester and supplier accounts.
2. Create an open request.
3. Submit an offer as a supplier.
4. Select the offer as the requester.
5. Start execution as an authorized participant.
6. Complete the request.
7. Submit one supplier review as the requester.
8. Verify duplicate review attempts fail.

## 6. PRO tests

Test:

- FREE supplier
- pending PRO request
- Admin activation
- active PRO before expiry
- effective expiry after `expires_at`
- Admin extension
- Admin cancellation

Confirm that users cannot directly change subscription status, plan, or expiry.

## 7. Verification tests

Test:

- supplier creates pending verification request
- supplier cannot approve itself
- Admin approves
- Admin rejects
- supplier cancels only its own pending request
- `supplier_profiles.verified` changes only through the Admin verification RPC

## 8. Support tests

Test:

- user creates a ticket and first message atomically
- user sees only own tickets
- user sees only messages from own tickets
- another user cannot access a ticket by UUID
- user can reply while open/in progress/waiting_user
- resolved/closed tickets reject normal replies
- owner can reopen resolved/closed ticket
- Admin can search/filter/paginate all tickets
- Admin can reply
- Admin can change status and priority
- closing sets `closed_at`
- reopening clears `closed_at`
- support reply/status notifications are created for the ticket owner
- Admin does not receive a support notification for their own admin action

## 9. Storage tests

Test ownership and privacy for:

- supplier portfolio (`supplier-work`)
- request attachments
- offer attachments

Verify private attachment objects cannot be fetched by an unrelated authenticated user and signed URLs only work for authorized records.

## 10. Visibility tests

Test both FREE and PRO suppliers against the current visibility policy.

Verify that an inaccessible/closed request cannot be reached through:

- direct request URL
- saved requests
- matching results
- matching notifications
- RPC calls

## 11. Notifications

Verify existing notification types still work and that:

- `support_reply` opens `/support/:ticketId`
- `support_status_changed` opens `/support/:ticketId`
- notifications are readable only by their owner

## 12. Final production checks

Before release, record separately whether each test was:

- Static Code Review
- Build Test
- Local Test
- Supabase Live Test
- Manual E2E Test

Do not mark Supabase Live or Manual E2E as passed until the tests have actually been executed.
