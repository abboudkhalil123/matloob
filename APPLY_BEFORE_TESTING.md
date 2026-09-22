# MATLOOB — QA fixes + settings additions

## Supabase migration required
Before testing the new admin account controls and account deletion, apply:

`supabase/migrations/20260922100000_matloob_settings_admin_controls.sql`

This migration adds `profiles.is_active`, admin suspend/reactivate and request-delete RPCs, and the user account deletion RPC.

## Included UI changes
- Admin accounts now stay on the normal Dashboard route instead of redirecting to Admin.
- Admin can suspend/reactivate non-admin users.
- Admin can delete requests with confirmation.
- Mobile home shows Login/Register actions.
- Mobile header keeps Notifications visible and uses a clear hamburger icon.
- Request creation waits for attachments; a 30-second upload timeout prevents an endless "Uploading" state, and a failed attachment upload prevents the request from remaining published without its attachment.
- Added protected Settings page at `/settings` with password change, logout, Arabic/English language switch, notification preference, and account deletion.
- Added language persistence and broad UI translation support for English mode.
