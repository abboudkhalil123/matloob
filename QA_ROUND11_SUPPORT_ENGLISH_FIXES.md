# MATLOOB QA Round 11

## Support detail fix
- Recreated `get_admin_support_ticket(uuid)` with explicit casts and LEFT JOINs.
- Recreated `get_admin_support_messages(uuid)` with explicit casts and LEFT JOINs.
- This fixes the PostgreSQL `structure of query does not match function result type` error when opening an admin ticket.

## English UI coverage
- Added a stronger phrase-level English dictionary for major public, request, offer, account, notification, support, admin, and PRO screens.
- Added translation of `title` and `aria-label` attributes.
- Existing Arabic/English persistence and RTL/LTR switching remain intact.
- User-entered names, request descriptions, supplier descriptions, and other user-generated content are intentionally not machine-translated.
