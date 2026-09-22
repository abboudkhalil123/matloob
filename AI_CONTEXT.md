# MATLOOB — AI Context & Project Rules

These rules apply to every future AI-assisted change to this project.

1. Do not rewrite working features without a reason.
2. Do not delete existing functionality.
3. Do not introduce mock data as a replacement for real database data.
4. Do not use localStorage as the primary database.
5. Do not expose secrets.
6. Keep the project modular.
7. Preserve Arabic RTL.
8. Before making large changes, inspect the existing project structure.
9. Make small changes and verify the build after each change.

## Current foundation scope

This project is intentionally empty at this stage. Do not add authentication, database tables, requests, offers, PRO, admin, or other application features unless a future task explicitly requests them.

## Step 9 scope
- Supplier database foundation is now implemented only for `supplier_profiles`, `supplier_categories`, and `supplier_working_hours`.
- Supplier data must use the real Supabase database; never replace it with localStorage or mock data.
- Supplier ownership is enforced with `auth.uid()` and the user's `profiles.role = 'supplier'`.
- `/profile/edit`, `/suppliers`, and `/suppliers/:id` use `supplierService` and real Supabase data.
- Supplier images/avatars/logos/portfolio remain disabled until a separately requested Storage step.
- Do not add offers, reviews, ratings, PRO, verification, notifications, matching, payments, Admin, or other later-stage tables unless explicitly requested.

## Step 10 scope
- Offers use the real Supabase database only; never use localStorage or mock offer records.
- An offer belongs to exactly one `requests` row and one `supplier_profiles` row, with a unique `(request_id, supplier_id)` pair.
- Only authenticated supplier owners can create/update/delete their own offers, and only on open requests belonging to another user.
- Request owners can read offers for their own requests; other authenticated users must not see those offers.
- Offer creation/editing does not change request status. Offer selection and later workflows remain separate future steps.

## Step 12 scope
- Request lifecycle transitions use dedicated Supabase RPCs only; never use a direct client UPDATE for `requests.status` or `requests.selected_offer_id`.
- Allowed normal workflow is `open → closed`, `open → supplier_selected` (Step 11), `supplier_selected → in_progress`, `in_progress → completed`.
- Cancellation is limited to active states: requester-only from `open`, and requester or the selected supplier from `supplier_selected`/`in_progress`; `closed`, `completed`, and `cancelled` are terminal.
- Workflow RPCs are `SECURITY DEFINER`, use a restricted `search_path`, verify `auth.uid()`, lock the request row with `FOR UPDATE`, validate the current state, and validate the selected offer/supplier where required.
- Do not introduce GUC, `set_config`, or `current_setting` as an authorization mechanism. The earlier Step 11 hardening remains the authorization boundary for protected request columns.
- Request lifecycle UI must remain a convenience layer only; PostgreSQL RPCs and RLS/column privileges are the actual security boundary.
- No notifications, reviews, ratings, PRO, Admin, payments, Storage, portfolio, or integrations are part of Step 12.

## Step 13 scope
- Notifications use the real Supabase database only; never use localStorage or mock notification records.
- `notifications` is protected by RLS: authenticated users can SELECT only their own rows and UPDATE only `is_read` on their own rows. No authenticated INSERT privilege is granted.
- Notification creation is a database responsibility, not a frontend responsibility. Trusted SECURITY DEFINER triggers create notifications atomically for new offers, offer selection, and request lifecycle status changes.
- Notification trigger functions use a restricted `search_path` and do not use GUC, `set_config`, or `current_setting` as an authorization mechanism.
- Supported notification types are `new_offer`, `offer_selected`, `request_started`, `request_completed`, and `request_cancelled` only.
- `/notifications` is protected and uses `notificationService`; the header only loads the unread count on application load/authentication. Realtime is intentionally deferred.
- Preserve Step 11 protected offer selection and Step 12 request lifecycle RPCs; do not replace their database security with frontend checks.
- No Reviews, Ratings, PRO, Admin, Payments, Storage, Telegram, WhatsApp, or other later-stage features belong to Step 13.

## Step 14 — Reviews & Ratings
- Added independent migration `supabase/migrations/20260920000000_create_reviews.sql`.
- Added real `reviews` table with rating 1–5, comment length limit, and `UNIQUE(request_id, reviewer_id)`.
- Review creation is restricted to the secure `create_supplier_review(p_request_id, p_rating, p_comment)` SECURITY DEFINER RPC.
- Review creation is allowed only for the request owner after the request reaches `completed` and only for the supplier attached to the selected offer.
- Direct authenticated INSERT/UPDATE/DELETE on `reviews` is revoked; authenticated users can read review data through RLS.
- Added `src/types/review.ts` and `src/services/reviewService.ts`.
- Supplier details now show real average rating, count, and review list without exposing reviewer identity in the UI.
- Completed request details now allow the request owner to submit one supplier review, with duplicate prevention and post-submit state refresh.
- No notification type was added or changed. No localStorage/mock data.
- Step 11, Step 12, and Step 13 source/migrations were preserved unchanged.
- Migration was not applied; npm install and build were not run.


## Step 15 engineering rules
- Supplier portfolio files use Supabase Storage bucket `supplier-work`.
- Storage paths are generated from the authenticated supplier user ID: `{user_id}/portfolio/{uuid}.{extension}`.
- Allowed portfolio images are JPG/JPEG/PNG/WEBP and max 5 MB; backend Storage/bucket and database constraints enforce the limits in addition to frontend validation.
- `supplier_portfolio.supplier_id` references `supplier_profiles.user_id`, and RLS requires ownership through `auth.uid()`.
- Portfolio images are not stored in the database; only metadata and storage paths are stored.
- Upload metadata failure triggers Storage cleanup. Storage deletion must succeed before metadata deletion.
- Portfolio reads use public Storage URLs; the bucket is public for image display, while writes/deletes are owner-restricted.
- No localStorage, fake data, secrets, GUC, `set_config`, or `current_setting`.

## Step 16 engineering rule
Request and offer attachments use separate private Supabase Storage buckets and metadata tables. Attachment authorization must be enforced in both database RLS and Storage policies; frontend visibility is never the security boundary. Private files are exposed through short-lived signed URLs. Allowed types are JPG/JPEG/PNG/WEBP/PDF and Storage/database enforce a 10 MB maximum. No attachment feature may introduce localStorage, fake data, Storage secrets, GUC, set_config, or current_setting. Steps 11–15 logic must remain unchanged.

## Step 17 engineering rule
Search and pagination must be server-side through Supabase query/RPC parameters. Never load an unbounded directory and filter/slice it in React. Request ordering uses `created_at` plus `id`; supplier ordering uses `created_at` plus `id`. Search state belongs in URL query parameters, not localStorage. Rating filters must use the existing `reviews` relation; do not add a rating column to supplier profiles. PRO/verification remain out of scope until their database structures exist.

## Step 18 engineering rule — subscriptions
- PRO authority must come from Supabase database/RPC, never React state, localStorage, URL flags, or cookies.
- Supplier PRO requires `profiles.role = supplier`, `status = active`, `expires_at > now()`, and plan code `PRO`.
- Expiration is effective immediately from `expires_at` even without Cron.
- Authenticated users can read only their own subscription rows and cannot directly insert/update/delete them; frontend can request `pending` only through a restricted RPC.
- Subscription plan price is read from `subscription_plans`; do not hardcode it as a source of truth.
- Do not add Admin/payment/notification/matching/ranking functionality as part of this step.

## Step 19 engineering rules — Admin PRO management
- Admin authorization is based on membership in `public.admin_users`, not `profiles.role`, email, hardcoded UUIDs, query parameters, localStorage, or frontend state.
- `admin_users` has RLS enabled and no authenticated INSERT/UPDATE/DELETE grants. Initial Admin provisioning is intentionally outside public UI and must be performed by a trusted database operator.
- `is_admin(p_user_id)` requires `auth.uid()` to exist and equal the requested user ID, then checks `admin_users`.
- Admin PRO reads and mutations use SECURITY DEFINER RPCs with restricted `search_path`; the browser never performs direct subscription mutations.
- PRO activation validates Admin, supplier ownership, PRO plan, pending status, active-subscription uniqueness, start time, and expiration time. Default duration comes from `subscription_plans.duration_days`.
- PRO extension accepts 1–3650 days only; active subscriptions extend from their current future expiration, while expired subscriptions restart from `now()` and become active.
- Expiration changes are allowed only for active/expired PRO records and cannot set an active subscription into the past. A future expiration becomes active; a past expiration becomes expired.
- Step 18 `has_active_pro_subscription`, `get_current_subscription`, `create_pro_subscription_request`, and the partial unique active-subscription index remain unchanged.
- `/admin/pro` is a focused PRO-management page only. It is not a general Admin dashboard and does not add user/request/supplier/category/report/support management.
- No PRO notifications, payments, Telegram API, localStorage, fake data, service-role keys, GUC, `set_config`, or `current_setting`.

## Step 20 — Supplier Verification
- Verification is a separate trust state from PRO.
- `verification_requests` stores the supplier request lifecycle: pending, approved, rejected, cancelled.
- `supplier_profiles.verified` is database-controlled and cannot be changed by ordinary supplier profile updates.
- Supplier creation/cancellation and Admin review use SECURITY DEFINER RPCs with `pg_catalog, public` search paths and no GUC/config state.
- Admin access is based on the existing Step 19 `admin_users` / `is_admin` mechanism.
- UI includes `/admin/verification`, supplier verification state/actions in `/profile/edit`, and a Verified badge on supplier details.
- No verification notifications, sensitive identity documents, payments, matching, ranking, or other Admin domains were added.


## Step 21 — Request Visibility Policy
- Added `request_visibility_policy` singleton configuration with FREE/PRO visibility switches, defaulting to enabled for both.
- Added database RPC `can_supplier_view_request(uuid)` using the existing `has_active_pro_subscription` logic.
- Supplier discovery is restricted to `open` requests and the database policy; selected suppliers retain existing Step 12 read access.
- Updated `search_requests` through a new migration so supplier results are policy-controlled server-side while existing search/pagination inputs remain available.
- Added `requestVisibilityService.ts` and a guarded supplier request-details state.
- No matching, new notifications, favorites, dashboards, reports, support, localStorage, service-role frontend usage, or direct client policy writes.
- Step 21 static audit only; no npm install/build or live Supabase migration was run.


## Step 22 — Supplier / Request Matching
Step 22 adds a reusable database matching layer without adding a new UI. `get_matching_suppliers_for_request(p_request_id)` accepts only authenticated users, requires an open request, and authorizes requester-owned requests, existing Admin authorization, or Supplier access through `can_supplier_view_request()` from Step 21. Matching is category-first: `requests.category_id` must match `supplier_categories.category_id`. Same city is optional and adds 20 points; verified adds 5; active PRO adds 5; category contributes 70. Results are ordered by score DESC, supplier created_at DESC, supplier user_id ASC. The matching RPC is read-only. Because Step 18 `has_active_pro_subscription()` intentionally validates only the current caller, Step 22 uses a private, non-client-executable helper with the same active PRO conditions to score each matched supplier. No request mutation, offer mutation, subscription mutation, verification mutation, notifications, favorites, dashboards, or matching UI were added.

## Step 23 engineering rules — matching request notifications
- `matching_request` is a database-generated notification for newly inserted `open` requests only.
- The existing Step 13 `notifications.related_request_id` is the request reference; no second request ID column is introduced.
- Matching notification eligibility is category match + supplier role + Step 21 FREE/PRO visibility. City, verification, and active PRO remain non-blocking matching/score factors; city is included in the message when present.
- The request owner never receives a `matching_request` notification for their own request.
- A partial unique index prevents duplicate `matching_request` rows for the same supplier/request pair.
- React only reads/marks notifications; it never creates matching notifications.
- The trigger uses a private visibility helper because `can_supplier_view_request()` depends on `auth.uid()` and cannot evaluate arbitrary suppliers from a database trigger.
- Existing Step 13 notification types, RLS, header unread count, and lifecycle triggers remain compatible.
- No backfill, cron, Edge Function, external service, Favorites, Dashboard, Reviews, Payment, Support, Admin Dashboard, or Matching UI is part of Step 23.

## Step 24 — Saved Requests

The current MATLOOB step is Step 24. Suppliers can save visible open requests into `saved_requests` and later unsave them. Database security derives supplier identity from `auth.uid()` and checks `can_supplier_view_request()` plus `requests.status = 'open'` at save time. The unique `(supplier_id, request_id)` constraint prevents duplicates. Saved rows remain after the request status changes; request details never bypass the existing `requests` RLS. The frontend uses `savedRequestService.ts` and `/supplier/saved-requests` with 12-item database pagination. No notification or matching logic was added in Step 24.

## Step 25 engineering rules — user dashboards
- `/dashboard` is role-aware: requester gets requester dashboard; supplier gets supplier dashboard; Admin is not given a general dashboard in this step.
- Dashboard data is real Supabase data only. Requester queries filter by `requester_id`; supplier queries derive supplier identity from the authenticated profile/supplier profile.
- Requester latest requests are ordered and limited in the database; offer counts are read through the existing `offers` relation for the limited latest set. Completed review prompts use the existing `hasReviewedRequest` logic and link to Request Details.
- Supplier matching cards reuse Step 22 `get_matching_suppliers_for_request` against requests returned by Step 21-visible open-request discovery; no new matching algorithm is implemented.
- Supplier saved requests reuse Step 24 `getSavedRequests`/`unsaveRequest`; saved request details never bypass request RLS.
- Supplier offer statistics and latest offers are limited to the current supplier. `getMyOffers` now accepts an optional limit while preserving previous callers.
- Verification state comes from existing supplier profile `verified` plus the existing verification request lifecycle. Subscription state comes from `get_current_subscription`; an expired PRO is not displayed as active.
- No new migration/RPC/View/RLS policy/permission was introduced in Step 25.
- No localStorage, fake data, service-role frontend key, hardcoded IDs, or RLS bypass.

## Step 26 — Admin Dashboard
- Admin identity/security: existing `admin_users` + `is_admin(auth.uid())`; no `profiles.role='admin'` was introduced.
- New migration: `20260920110000_admin_dashboard.sql`.
- New read-only admin RPCs: `get_admin_stats`, `get_admin_users`, `get_admin_requests`, `get_admin_suppliers`.
- New service: `src/services/adminService.ts`.
- New type file: `src/types/admin.ts`.
- New pages: `AdminDashboardPage`, `AdminUsersPage`, `AdminRequestsPage`, `AdminSuppliersPage`.
- Existing `/admin/pro` and `/admin/verification` were not rebuilt; only linked from `/admin`.
- Admin list queries are server-side paginated and filtered. No localStorage, service_role, hardcoded admin IDs/emails, or frontend RLS bypass.
- Step 26 verification: static forbidden-pattern scan passed for the new Step 26 implementation. Build was attempted but blocked by missing React/Vite dependency declarations in the environment; live Supabase was not tested.

## Step 27 — Admin Categories & Cities Management
- Current base is Step 26 Admin Dashboard.
- New migration: `supabase/migrations/20260920120000_admin_categories_cities.sql`.
- Reference schema verified from Step 8: `categories(id,name,slug,created_at)` with unique name/slug; `cities(id,name,created_at)` with unique name. Step 27 adds `is_active` to both.
- Admin management uses only existing `admin_users` authorization through `is_admin(auth.uid())`; no new Admin role/auth mechanism was added.
- Admin RPCs are SECURITY DEFINER, use `SET search_path = pg_catalog, public`, authorize via `is_admin(auth.uid())`, and are executable only by authenticated users. Direct authenticated INSERT/UPDATE/DELETE table privileges are revoked.
- New/changed requests and new supplier category/city assignments are database-validated against active reference rows. Existing inactive references are preserved and remain readable.
- Public reference-data loaders now return only active categories/cities. Nested historical request/supplier lookups do not filter by active status.
- Admin pages: `src/pages/AdminCategoriesPage.tsx`, `src/pages/AdminCitiesPage.tsx`; types: `src/types/adminReference.ts`; service additions are in `src/services/adminService.ts`.
- Routes: `/admin/categories`, `/admin/cities`. Admin navigation and Dashboard quick actions were extended only for these two resources.
- Existing unique constraints are retained; no duplicate merge/delete is performed.
- Build was attempted but not successfully verified because the environment is missing React/Vite dependencies and has existing TypeScript errors. Live Supabase migration/testing was not performed.


## Step 28 — Admin Reports & Advanced Statistics
- Added `/admin/reports`, protected by the existing `AdminRoute` and `admin_users/is_admin()` model.
- Added PostgreSQL report RPCs for summary metrics, request funnel, offer analytics, top categories/cities, supplier activity, time-series activity, request status distribution, PRO analytics, and verification analytics.
- Added server-side date filtering with quick periods (7/30/90 days, month, year, all time).
- Added server-side pagination for category, city, and supplier report tables.
- Added CSS/HTML visualizations without introducing a chart dependency.
- No new roles, payment system, notifications, or unrelated feature changes.
- Build verification remains limited by the existing incomplete dependency environment; Supabase Live was not applied/tested.


## Step 29 — Support / Tickets System

- Added real Supabase/PostgreSQL support tickets and support messages.
- Added secure user and admin RPC workflows with RLS ownership enforcement.
- Added user routes `/support` and `/support/:id`.
- Added admin routes `/admin/support` and `/admin/support/:id`.
- Added notification types `support_reply` and `support_status_changed`, plus nullable `related_ticket_id`.
- Added admin support summary cards and navigation.
- No Realtime, external backend, email, WhatsApp, attachments, localStorage, sessionStorage, or mock ticket data.
- New migration: `20260920140000_support_system.sql`.
- Build attempted; result documented in Step 29 report.
- Supabase Live was not applied or tested in this step.

## Step 30 — Final Audit State
- Step 30 is the final pre-production audit; no new product feature was intentionally added.
- A real schema mismatch was found: `supplier_profiles.verified` was used by verification/reporting code but absent from the original Step 9 table. It is repaired by the new migration `20260920150000_final_audit_fixes.sql`.
- `AdminReportsPage.tsx` no longer uses `any` for report state; it uses the existing report types.
- `SUPABASE_LIVE_CHECKLIST.md` documents the manual Supabase/E2E gate.
- `PRODUCTION_READINESS.md` records the current readiness state.
- Build is environment-blocked; Supabase Live and manual E2E are not tested.
