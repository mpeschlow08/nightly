# Mobile and PWA Readiness Assessment

## Current state

- Platform is browser-first Next.js application.
- No Capacitor/native shell integration detected.
- No dedicated PWA service worker registration detected.
- Mobile routes render and navigation works in responsive layouts.

## Required for internal beta mobile browser support

- Ensure viewport and safe-area styling on critical pages.
- Verify auth redirects and protected route behavior on mobile web.
- Validate camera/location permission prompts for door and social features.

## Required for full PWA path

- Add web app manifest with app name, icons, theme color, and display mode.
- Add installability checks and offline shell strategy.
- Add static splash/icon asset matrix.
- Add explicit offline/degraded UX for critical routes.

## Capacitor compatibility notes

- Reuse existing web routes and APIs; avoid parallel native business logic.
- Wrap web build in Capacitor only after PWA baseline is stable.
- Gate camera/location/push usage behind explicit permission states.

## Deep-link readiness

- Keep route contracts stable for `/venues/[id]`, `/events/[slug]`, `/tickets/[id]`.
- Use URL-safe identifiers and server-side authorization on all sensitive routes.

## Privacy disclosures needed before public launch

- Location sharing modes and expiration behavior.
- Camera usage for door scanning and live adapters.
- Push notification categories and opt-out controls.
- Data retention and deletion request process.

## Recommendation

- Internal beta: mobile browser only.
- Public launch: enable PWA baseline first, then evaluate Capacitor wrapper.
