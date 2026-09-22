# QA Round 6 — attachment storage path fix

The request/offer attachment registration was failing at the database CHECK constraint for `storage_path`.

The original regex escaped the filename dot incorrectly, so valid paths like:

`<entity-uuid>/<file-uuid>.png`

were rejected. A new migration drops and recreates both request and offer attachment constraints with the correct regex. The original migration was also corrected so fresh installations receive the fixed constraint.

**Important:** Run the new migration `20260921190000_fix_attachment_storage_path_constraints.sql` in Supabase before retesting attachments.
