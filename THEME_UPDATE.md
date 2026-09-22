# Theme update

- English localization has been removed from the application.
- The language provider and English locale files were removed.
- Settings now offers Light / Dark appearance instead of language selection.
- Theme choice is persisted in `localStorage` under `matloob-theme`.
- Dark mode is applied globally through `data-theme="dark"` with compatibility overrides for the existing Tailwind UI.
- No Supabase migration is required.
