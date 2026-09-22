# MATLOOB QA Round 2 Fixes

This build addresses the latest reported QA issues:

1. Supplier ratings/reviews now load using `supplier_profiles.user_id`, which matches `reviews.reviewed_supplier_id`.
2. Main authenticated navigation now explicitly shows `لوحة التحكم`; admins see `لوحة الإدارة` and are routed to `/admin`.
3. Opening `/dashboard` as an admin redirects to the real admin dashboard instead of rendering an empty requester dashboard.
4. Supplier dashboard keeps saved requests visible inside the dashboard and links to the full saved-requests page.
5. Added a new idempotent Supabase migration `20260921150000_fix_qa_ratings_dashboard_attachments.sql` that simplifies and hardens Storage upload policies for request/offer attachments.

Apply only the new migration after the previous migrations have already been applied.
