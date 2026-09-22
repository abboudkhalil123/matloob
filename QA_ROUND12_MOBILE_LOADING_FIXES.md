# QA Round 12 — Mobile Loading / Compatibility Fixes

## Changes
- Reduced the cost of the DOM translation observer: translation is now queued/debounced instead of re-running for every React DOM insertion.
- Gracefully handles browsers where `MutationObserver` is unavailable.
- Set Vite production build target to ES2018 for broader older-mobile browser compatibility.
- Added a startup React error boundary so a runtime startup error shows a readable fallback instead of a blank/stuck page.
- Preserved all Round 11 support-ticket and English-language changes.

## Verification note
A full `npm run build` could not be completed in the isolated environment because `npm ci` timed out while installing dependencies. The source changes were inspected directly; do not treat this as a successful production build verification.
