# MATLOOB Step 7 — First E2E Test Fixes

Based on the first manual test after Step 6:

- Requests and supplier directory are now protected by the existing authentication gate because their Supabase read RPCs/RLS require authenticated users. Anonymous visitors are sent to `/login` instead of seeing a Supabase loading error.
- Direct request and supplier detail URLs are also protected for the same reason.
- The homepage no longer calls the authenticated request-search RPC for anonymous visitors.
- Added `/support` and `/support/:id` routing to the existing support pages.
- Footer links now use real routes for Support, Terms, and Privacy instead of hash anchors that leave the home page unchanged.
- Added simple Terms and Privacy pages.

No database migrations were changed in Step 7.
