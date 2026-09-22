# MATLOOB QA Round 3

This round fixes the latest reported issues:

- The main homepage now contains the **لوحة التحكم** button for authenticated users (or **لوحة الإدارة** for admins).
- The repeated dashboard button was removed from the inner SiteHeader, so it is not shown as a separate button in the requests area.
- The requester dashboard no longer uses the nested `offers(count)` query that could fail through RLS recursion; offer counts are loaded separately.
- Attachment Storage policies are normalized by removing older conflicting attachment-bucket policies and recreating deterministic owner/participant policies.

Apply only the new migration:
`supabase/migrations/20260921160000_fix_final_attachments_and_dashboard.sql`
