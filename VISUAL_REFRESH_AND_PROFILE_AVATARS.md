# MATLOOB — Visual Refresh + Profile Avatars

## Visual refresh
- Reworked the shared visual system around a modern blue/purple marketplace dashboard style.
- Added a clearer dashboard layout with sidebar navigation, profile summary, Pro/action card, and responsive mobile navigation.
- Rebuilt dark-mode contrast using dedicated dark surface/text/border variables instead of simply inverting the light palette.
- Refined header, cards, hero sections, forms, profile areas, and mobile tap targets.

## Profile pictures
- Requesters and suppliers can upload a JPG/PNG/WEBP profile picture up to 5 MB from Edit Profile.
- The avatar is stored in the Supabase `avatars` public bucket under the authenticated user's folder.
- Users can replace or remove their picture.
- The profile picture appears in the site header and supplier public profile.
- Older browsers get a UUID fallback so avatar uploads do not depend on `crypto.randomUUID()`.

## Supabase
Apply the new migration:
`supabase/migrations/20260922130000_profile_avatars_and_visual_refresh.sql`

It adds `profiles.avatar_url`, creates/configures the `avatars` bucket and policies, and adds the authenticated `get_public_profile(uuid)` RPC used for supplier profile avatars.

## Verification note
A full `npm ci`/production build could not be completed in the current sandbox because dependency installation timed out. No claim of a verified production build is made here.
