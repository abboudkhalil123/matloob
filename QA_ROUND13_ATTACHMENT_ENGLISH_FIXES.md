# MATLOOB QA Round 13 — Mobile Attachments + English UI

## Fixes

### 1. Mobile request attachment failure
The mobile browser fallback for `crypto.randomUUID()` previously generated a timestamp/random slug. Supabase's `request_attachments_storage_path_check` requires the second path segment to be UUID-shaped. The fallback now generates a UUID v4-shaped value, so request and offer attachment storage paths satisfy the existing database constraint.

### 2. Offer attachments
The same attachment service is used for request and offer uploads, so the UUID fallback fix applies to offer attachments as well. The existing UI continues to report upload failures instead of silently claiming the attachment was uploaded.

### 3. English UI coverage
Expanded exact phrase translations across the main site, authentication, dashboard, supplier profile, verification, support/tickets, admin areas, requests/offers, subscription/PRO, and common status/error text. Existing RTL/LTR persistence and DOM translation behavior remain in place.

## Database
No new SQL migration is required for the attachment-path fix. The existing constraint is intentionally kept as UUID/UUID.extension. The frontend now generates a compatible fallback UUID on old browsers.

## Verification note
The latest project was not fully build-verified in this environment because `npm ci` timed out. Do not treat this as a claim of a successful production build.
