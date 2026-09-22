# Changelog

All notable changes to MATLOOB will be recorded in this file.

## [0.1.0] - 2026-09-19

### Added
- Initial React + TypeScript + Vite project foundation.
- Tailwind CSS integration.
- Arabic RTL document configuration.
- Initial project state documentation.
- Initial AI project rules documentation.

### Not implemented
- Authentication.
- Database tables.
- Supabase integration.
- Requests.
- Offers.
- PRO features.
- Admin features.
- Other application features.

## [0.3.0] - 2026-09-19
- Added the frontend-only requests section at `/requests`.
- Added reusable `RequestCard` component without connecting it to data.
- Added request details shell at `/requests/:id`.
- Added request creation form at `/requests/create` without persistence.
- Connected homepage navigation to the new request routes.
- No backend, database, authentication, Supabase, localStorage, or mock request records were added.

## [0.4.0] - 2026-09-19
- Added the frontend-only suppliers section at `/suppliers` with search and responsive filters.
- Added reusable `SupplierCard` without connecting it to a data source.
- Added supplier profile shell at `/suppliers/:id` with privacy-aware contact placeholders and portfolio section.
- Added frontend-only profile editing page at `/profile/edit` with multi-select supplier categories and weekly working hours.
- Connected homepage supplier navigation and account/profile navigation.
- No backend, database, authentication, Supabase, Storage, localStorage, PRO logic, notifications, admin, or mock supplier records were added.


## [0.5.0] - 2026-09-19
- Added `@supabase/supabase-js` as the Supabase client dependency.
- Added `src/lib/supabase.ts` as the central environment-based Supabase client foundation.
- Added `.env.example` with the required Supabase environment variable names only.
- Added explicit handling for incomplete Supabase environment configuration without using mock data.
- Updated `.gitignore` to keep local environment files out of version control while retaining `.env.example`.
- No authentication, database tables, migrations, storage, RLS, or application data connections were added.


## [0.6.0] - 2026-09-19
- Added Supabase Authentication login at `/login`.
- Added account registration at `/register` with service seeker/supplier account type metadata.
- Added password-reset request at `/forgot-password`.
- Added centralized auth session handling with `getSession()` and `onAuthStateChange()`.
- Added reusable `ProtectedRoute` for authenticated pages.
- Protected `/profile/edit` and `/requests/create` without changing their existing functionality.
- Added signed-in state and sign-out control to the existing homepage header.
- No database tables, migrations, Storage, RLS, PRO, Admin, Notifications, or localStorage-based auth were added.

## [0.7.0] - 2026-09-19
- Added the `profiles` Supabase migration linked to `auth.users(id)` with role validation for `requester` and `supplier` only.
- Added automatic Profile creation from Auth user metadata with safe fallback to email and a contained trigger error path.
- Added `profiles` `created_at`/`updated_at` defaults and automatic `updated_at` maintenance.
- Enabled RLS for `profiles` with own-profile select/update policies only; no public access, user insert, or delete policy was added.
- Added `Profile` TypeScript types and `profileService` for reading/updating the current user's Profile.
- Connected the existing Auth provider to load the current Profile and use persistent Profile name data in the existing account header.
- No requests, supplier profiles, offers, reviews, notifications, subscriptions, portfolio, categories, cities, or other tables were created.
- Migration was prepared locally and was not applied to a real Supabase Project in this environment.

## [0.8.0] - 2026-09-19
- Added the `requests` database table linked to `profiles`, with controlled request statuses and timestamp maintenance.
- Added `categories` and `cities` reference tables with only the requested seed data.
- Added RLS for requests, categories, and cities using authenticated access and requester ownership rules.
- Added `Request`, `Category`, `City`, and `RequestStatus` TypeScript types.
- Added `requestService` for request CRUD, request lookup, and reference-data loading with pagination-ready query parameters.
- Connected `/requests` to real Supabase data with loading, empty, error, search, category/city/status/date filters.
- Connected `/requests/create` to real Supabase insertion for the authenticated user.
- Connected `/requests/:id` to real Supabase request details.
- Kept attachments/Storage, offers, supplier profiles, matching, PRO, Admin, Notifications, and other later-stage features out of this step.
- Migration was prepared locally and was not applied to a real Supabase Project in this environment.

## [0.9.0] - 2026-09-19
- Added the `supplier_profiles` database table linked one-to-one with `profiles` and restricted supplier ownership by RLS.
- Added the `supplier_categories` many-to-many link table for supplier category selection.
- Added the `supplier_working_hours` table with Saturday-Friday day mapping and one row per supplier/day.
- Added RLS policies for authenticated supplier-directory reads and owner-only supplier mutations; no anonymous or Admin access was added.
- Added `SupplierProfile`, `SupplierCategory`, and `SupplierWorkingHour` TypeScript types.
- Added `supplierService` for supplier profile, category, and working-hour CRUD/read operations through Supabase.
- Connected `/profile/edit` to real Profile and supplier-profile data; requester accounts only edit their general profile name and cannot create supplier profiles.
- Connected `/suppliers` and `/suppliers/:id` to real Supabase supplier data without fake records, ratings, PRO, verification, or Storage.
- Disabled supplier image/logo/portfolio uploads until the separate Storage stage.
- Migration was prepared locally and was not applied to a real Supabase Project in this environment.

## [0.10.0] - 2026-09-19
- Added the `offers` database table linked to `requests` and `supplier_profiles` with a unique request/supplier constraint.
- Added controlled offer duration units and automatic `updated_at` maintenance.
- Added RLS so suppliers can manage only their own offers and request owners can read offers on their own requests; other authenticated users cannot access those offers.
- Restricted offer creation to authenticated supplier accounts with their own supplier profile and open requests owned by another user.
- Added `Offer` and `OfferDurationUnit` TypeScript types and `offerService` for offer CRUD and retrieval.
- Connected request details to real Supabase offers with supplier-only create/edit/delete UI and request-owner offer visibility.
- Kept offer creation from changing request status and did not add selection, notifications, ratings, PRO, Admin, Storage, or other later-stage features.
- Migration was prepared locally and was not applied to a real Supabase Project in this environment.

## [0.12.0] - 2026-09-19
- Added secure request lifecycle RPCs: `start_request_execution`, `complete_request`, `close_request`, and `cancel_request`.
- Kept the existing request statuses unchanged and enforced only the allowed workflow transitions.
- Kept `status` and `selected_offer_id` protected from direct authenticated UPDATEs; no client-controlled GUC or `set_config`/`current_setting` mechanism was introduced.
- Added database-side validation for selected-offer state and selected supplier validity without changing `selected_offer_id` in Step 12.
- Added request lifecycle controls to `RequestDetailsPage.tsx` with role/state-aware visibility, confirmation dialogs, Arabic success/error messages, and a fresh Supabase request read after successful operations.
- No notifications, reviews, PRO, Admin, payments, Telegram, WhatsApp, Storage, portfolio, ratings, or other later-stage features were added.
- Migration was prepared locally and was not applied to a real Supabase Project.
- No `npm install` or build was run for Step 12.

## [0.13.0] - 2026-09-19
- Added the `notifications` Supabase table with UUID/timestamp fields and controlled notification types.
- Added strict RLS: users can read only their own notifications and update only `is_read`; direct notification INSERT is not granted.
- Added trusted database triggers for new offers, selected offers, request start/completion, and request cancellation.
- Kept notification creation inside the same database transaction as the triggering event; no frontend-only notification creation path was introduced.
- Added `Notification` TypeScript types and `notificationService` using real Supabase data only.
- Added protected `/notifications` page with read/unread state, related-request navigation, and mark-all-read.
- Added an unread notification badge to the authenticated header.
- No GUC, `set_config`, `current_setting`, localStorage, mock data, Realtime, or Step 14 features were added.
- Step 11 and Step 12 workflow/security logic was preserved.
- Migration was prepared locally and was not applied to a real Supabase Project.


## Step 15 — Supplier Portfolio
- Added `20260920010000_create_supplier_portfolio.sql`.
- Added `supplier_portfolio` table, indexes, `updated_at` trigger, and strict RLS.
- Added `supplier-work` Storage bucket with public read, authenticated supplier-owned upload/update/delete policies, 5 MB and image MIME restrictions.
- Added `src/types/portfolio.ts` and `src/services/portfolioService.ts`.
- Added real portfolio upload, local preview, success/error states, and owner-only deletion to `EditProfilePage`.
- Added real portfolio gallery and empty state to `SupplierDetailsPage`.
- No changes to Step 11, 12, 13, or 14 logic.
- No migration execution, npm install, or build.

## Step 16 — Request & Offer Attachments
- Added migration `20260920020000_create_request_attachments.sql`.
- Added `request_attachments` and `offer_attachments` metadata tables.
- Added private Storage buckets `request-attachments` and `offer-attachments` with 10 MB limits and allowed MIME types.
- Added database RLS and Storage policies for request/offer ownership and visibility.
- Added `src/types/attachment.ts` and `src/services/attachmentService.ts`.
- Added signed URL generation for private files.
- Added request attachment upload/status UI to `CreateRequestPage` and attachment display/delete to `RequestDetailsPage`.
- Added offer attachment upload/delete/display UI to `RequestDetailsPage`.
- Preserved Steps 11–15 logic and did not add unrelated features.
- No migration, npm install, or build executed.

## Step 17 — Search / Filters / Pagination
- Added server-side Supabase search and pagination for requests.
- Added request filters for category, city, status, minimum quantity, delivery date, and publication order.
- Added server-side supplier directory search, category/city filters, and minimum rating filter using `reviews`.
- Added URL query parameters and 400ms debounce.
- Added loading, empty, error/retry, and pagination states.
- Kept PRO and verification inactive because they are not implemented.
- No localStorage, fake data, service-role key, GUC, `set_config`, or `current_setting` added.

## Step 18 — Subscription foundation
- Added `subscription_plans` and `subscriptions` migration.
- Seeded FREE and PRO (500 SYP / 30 days).
- Added expiration-aware PRO verification and current-subscription RPCs.
- Added pending-only PRO request RPC; no automatic activation.
- Added subscription RLS and removed direct authenticated writes to subscriptions.
- Added `src/types/subscription.ts`, `src/services/subscriptionService.ts`, and protected `/supplier/pro`.
- Added supplier-only PRO navigation entry.
- No payment, Admin, new notifications, or PRO policy/ranking logic.

## Step 19 — Admin PRO management
- Added `admin_users` and database-backed Admin authorization.
- Added `is_admin`, Admin PRO listing/pending RPCs, and secure activate/cancel/extend/set-expiration RPCs.
- Added `AdminRoute` and `/admin/pro`.
- Added `adminSubscriptionService.ts` and `AdminSubscription` type.
- Preserved Steps 11–18 and did not add payments or notifications.
- Static security audit only; no live Supabase migration/test or build.

## Step 20 — Supplier Verification
- Added supplier verification requests and database-controlled `verified` flag.
- Added secure supplier create/cancel RPCs and Admin approve/reject RPCs.
- Added `/admin/verification` with status filters and review actions.
- Added supplier verification state/actions to profile editing and Verified badge to supplier details.
- Kept verification independent from PRO; no new notifications or sensitive document collection.
- Static security audit only; no live Supabase/build test.


## Step 21 — Request Visibility Policy
- Added `request_visibility_policy` singleton configuration with FREE/PRO visibility switches, defaulting to enabled for both.
- Added database RPC `can_supplier_view_request(uuid)` using the existing `has_active_pro_subscription` logic.
- Supplier discovery is restricted to `open` requests and the database policy; selected suppliers retain existing Step 12 read access.
- Updated `search_requests` through a new migration so supplier results are policy-controlled server-side while existing search/pagination inputs remain available.
- Added `requestVisibilityService.ts` and a guarded supplier request-details state.
- No matching, new notifications, favorites, dashboards, reports, support, localStorage, service-role frontend usage, or direct client policy writes.
- Step 21 static audit only; no npm install/build or live Supabase migration was run.


## Step 22 — Supplier / Request Matching
- Added `20260920080000_supplier_request_matching.sql`.
- Added read-only `get_matching_suppliers_for_request(uuid)` with database-side category matching, score calculation, deterministic ordering, and Step 21 visibility enforcement.
- Added private `is_active_pro_supplier_for_matching(uuid)` because Step 18 `has_active_pro_subscription(uuid)` intentionally restricts checks to the current authenticated user; the private helper is not executable by authenticated clients and uses the same active PRO conditions (supplier role, PRO plan, active status, unexpired subscription).
- Added indexes for `supplier_categories.category_id`, `requests.category_id`, `requests.city_id`, and `supplier_profiles.city_id`.
- Added `src/types/matching.ts` and `src/services/matchingService.ts`.
- No Matching UI, notifications, favorites, dashboards, request mutations, offer creation, subscription mutation, or verification mutation.
- No localStorage, fake data, service-role key, GUC, hardcoded user/admin identifiers.
- Static audit only; no npm install/build or live Supabase migration was run.

## Step 23 — Matching Request Notifications
- Added database-owned matching notifications for newly inserted open requests.
- Added `matching_request` notification type and preserved existing Step 13 types.
- Reused `notifications.related_request_id`; added request/user indexes and a partial unique constraint for duplicate prevention.
- Added a private supplier visibility helper aligned with Step 21 FREE/PRO policy for trigger-time evaluation.
- Added `requests_matching_notification` AFTER INSERT trigger and trigger function.
- Matching notification recipients are suppliers with a matching category who are allowed to view the open request; the requester is excluded.
- Notification text includes request title and city when available and contains no phone/contact data.
- No historical backfill and no client-side notification creation.
- Notifications page only adds recognition of the new type; unread badge logic is unchanged.
- Static audit only; no npm install/build or live Supabase migration.

## Step 24 — Supplier Saved Requests

- Added `saved_requests` database table with supplier/request foreign keys and unique protection.
- Added supplier-only database RPCs for save, unsave, and saved-state checks.
- Enforced Step 21 request visibility and `open` status at save time.
- Added paginated supplier saved-requests page at `/supplier/saved-requests`.
- Added save/unsave controls to request details for suppliers.
- Preserved existing request RLS for later request access.
- No notifications, matching, payment, admin, or PRO changes.

## Step 25 — User Dashboards
- Added role-aware `/dashboard` with separate requester and supplier dashboard views.
- Requester: real request statistics, latest five requests, offer counts where available, action items, and completed requests needing review.
- Supplier: offer/workflow statistics, matching-based visible requests, latest five saved requests, latest five offers, verification state, subscription state, and quick actions.
- Added reusable dashboard stat/section/status components and `dashboardService.ts`.
- Dashboard queries use requester/supplier filters, ordering, limits, exact count queries, and existing RPC/services; no new backend security layer was added.
- Extended `getMyOffers` with an optional limit for bounded dashboard use without changing existing callers.
- Added `/dashboard` routing and authenticated header navigation.

## Step 26 — Admin Dashboard
- Added the protected `/admin` dashboard using the existing `admin_users` / `is_admin()` mechanism.
- Added read-only, admin-only database RPCs for platform statistics, users, requests, and suppliers with server-side search/filter/pagination.
- Added `/admin/users`, `/admin/requests`, and `/admin/suppliers` management views.
- Added quick links to existing `/admin/verification` and `/admin/pro` pages.
- No new admin role, public admin provisioning, authentication changes, or mutation workflow was added.

### Step 26 verification notes
- Static security scan found no `localStorage`, `service_role`, `set_config`, `current_setting`, hardcoded admin email, or hardcoded admin ID in the Step 26 implementation.
- `npm run build` was attempted. The environment is missing required React/Vite package declarations and the existing project also reports pre-existing TypeScript issues, so a successful build could not be verified.
- Supabase Live was not applied or tested from this environment.

## Step 27 — Admin Categories & Cities
- Added `supabase/migrations/20260920120000_admin_categories_cities.sql`.
- Added `is_active` to `categories` and `cities`.
- Added secure Admin RPCs: `get_admin_categories`, `create_admin_category`, `update_admin_category`, `set_admin_category_active`, `get_admin_cities`, `create_admin_city`, `update_admin_city`, `set_admin_city_active`.
- Added database-side active-reference enforcement for new/changed requests and supplier category/city assignments.
- Added `/admin/categories` and `/admin/cities` with search, status filters, pagination, CRUD metadata management, usage counts, loading/error/success feedback, and repeat-click protection.
- Added Admin navigation links and Dashboard quick actions for Categories/Cities.
- Existing direct authenticated write access to Categories/Cities remains disabled; read access remains available for existing application flows.
- Updated reference-data services so public forms/search filters expose only active categories/cities while historical records continue to resolve by ID.


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

## Step 30 — Final Production Audit
- Audited the project from Step 1 through Step 29 without adding new product features.
- Added `supabase/migrations/20260920150000_final_audit_fixes.sql` to repair the missing `supplier_profiles.verified` schema dependency safely.
- Replaced unnecessary `any` state types in `AdminReportsPage.tsx` with existing report types.
- Added `SUPABASE_LIVE_CHECKLIST.md` and `PRODUCTION_READINESS.md`.
- Build attempted but blocked by the current environment's missing dependencies.
- Supabase Live and manual E2E remain untested.
