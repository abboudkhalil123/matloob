# QA Round 5

- All authenticated users now enter `/dashboard`; admin users do not replace the dashboard with `/admin`.
- Admin-only `لوحة الإدارة` is shown at the bottom of the homepage next to privacy.
- Supplier dashboard no longer fails globally because an optional RLS/data query fails; available sections still render.
- Attachment database registration now uses security-definer owner-checked RPCs after Storage upload.
