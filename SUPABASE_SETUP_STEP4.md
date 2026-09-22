# MATLOOB — Supabase Live Setup (Step 4)

## What is ready
- Production build passes locally.
- Supabase client is already wired to Vite environment variables.
- All migrations are stored under `supabase/migrations/` and must be applied in timestamp order.
- The current migration set ends at `20260920180000_fix_requests_offers_rls_recursion.sql`.

## What is needed from the project owner
1. A Supabase project (existing or newly created).
2. The project's **Project URL**.
3. The project's **Publishable/Anon public client key**.

Do **not** provide a `service_role` key. It must never be placed in the frontend.

## Environment file
Create a local `.env.local` in the project root:

```env
VITE_SUPABASE_URL=YOUR_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Do not commit `.env.local` to source control.

## Migration application
Apply every SQL file in `supabase/migrations/` in filename order, including the three final RLS recursion fixes:

- `20260920160000_fix_request_visibility_rls_recursion.sql`
- `20260920170000_fix_matching_notification_rls_recursion.sql`
- `20260920180000_fix_requests_offers_rls_recursion.sql`

Do not mark the live database as tested until the migrations have actually been executed.

## First live smoke test
After configuration and migrations:

1. Open the application.
2. Create a requester account.
3. Confirm a `profiles` row is created.
4. Sign out.
5. Create a supplier account.
6. Confirm its `profiles` and `supplier_profiles` rows.
7. Test a simple authenticated read.

Then continue with the full RLS/workflow tests in `SUPABASE_LIVE_CHECKLIST.md`.
