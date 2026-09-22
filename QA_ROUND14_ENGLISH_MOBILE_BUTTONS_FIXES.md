# QA Round 14 — Full English UI Coverage + Mobile Action Visibility

- Added phrase-level English translation coverage for dynamic UI strings, service errors, support, requests, offers, profiles, verification, PRO, notifications, and admin screens.
- Phrase translations are now applied as substrings so runtime counts, dates, names, and other dynamic values do not leave Arabic UI fragments behind.
- Improved mobile action visibility: buttons and action links get usable tap targets, long labels wrap instead of being clipped, action rows wrap on narrow screens, and navigation controls remain visible/scrollable.
- Header notification, settings, and menu controls use 44px tap targets on small screens.

No Supabase migration is required for these frontend-only changes.
