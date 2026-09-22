# Localization rebuild

The previous large translation implementation was removed from `src/lib/language.tsx`.

English localization now lives in:

- `src/locales/en.ts` — centralized English catalog and dynamic translation rules.
- `src/locales/ar.ts` — reserved source-language module for future page-level i18n.
- `src/lib/language.tsx` — language state, DOM application, and catalog lookup only.

No Supabase migration is required for this rebuild.

The next architectural step, if desired, is to move page copy from hard-coded Arabic JSX into `t(...)` keys. This would make localization fully source-level instead of DOM-level.
