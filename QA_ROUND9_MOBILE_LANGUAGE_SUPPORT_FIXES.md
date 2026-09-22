# QA Round 9 – mobile/language/support fixes

- Added old-browser fallback when `crypto.randomUUID()` is unavailable.
- Increased request-attachment upload timeout to 90 seconds while preserving rollback on failure.
- Made admin navigation horizontally scrollable on narrow screens so buttons remain reachable.
- Admin support page now exposes the actual RPC error.
- Added a hardened admin support-ticket migration using LEFT JOINs and admin-only execution.

Apply the new migration before retesting the admin support page.

Note: the project still uses the existing DOM-based language layer from Round 8. A complete product-grade English localization would be better implemented through centralized i18n source strings.

## SQL follow-up fix
The support migration was corrected so `get_admin_support_summary()` is explicitly dropped before recreation and retains the original return shape expected by the frontend (`open_tickets`, `in_progress_tickets`, `waiting_user_tickets`, `urgent_tickets`).
