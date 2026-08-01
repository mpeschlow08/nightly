# Nightly Beta V1 Readiness

## Scope Lock

Beta V1 is now explicitly scoped in `lib/platform/beta-scope.ts`. Deferred surfaces are server-locked where they were clearly exposed in the repo, including owner live cameras and beta-only owner settings. The launch-readiness snapshot now reports included/deferred features and required flag coverage.

## Validation Summary

- `npm test`: pass
- `npm run lint`: pass with warnings only
- `npx tsc --noEmit`: pass
- `npm run build`: pass
- `npm run env:check`: pass
- `npm run db:status`: pass
- `npm run db:verify`: pass
- `npm run db:parity`: pass
- `npm run db:smoke`: pass
- `npm run smoke:routes`: pass after the dev server was running
- `npm run security:secret-scan`: pass
- `npm run security:deps-audit`: fail with known advisories in `esbuild`, `postcss`, and `sharp`

## Browser QA Evidence

Verified browser-rendered pages:

- `/`
- `/home`
- `/discover?filters=Live+Now&sort=recommended`
- `/live`
- `/events`
- `/events/sample-event` returned the expected 404 page
- `/venues/3`
- `/concierge`

Verified protected-route behavior:

- `/profile` redirects to Clerk sign-in when unauthenticated
- `/bookings` redirects to Clerk sign-in when unauthenticated
- `/dj/dashboard` redirects to Clerk sign-in when unauthenticated
- `/owner` redirects to Clerk sign-in when unauthenticated
- `/owner/cameras` redirects to Clerk sign-in when unauthenticated
- `/admin` redirects to Clerk sign-in when unauthenticated

Verified API responses:

- `/api/live` returns JSON with `status: ok`
- `/api/health` returns JSON health data
- `/api/ready` returns JSON readiness data and reports degraded provider readiness

## Known Gaps

- Authenticated end-to-end QA could not be completed because no deterministic test identities were provisioned in this run.
- Payment, email, push, SMS, realtime, AI, wallet pass, scheduler, and error-monitoring providers remain unconfigured.
- Clerk dev-key warnings and a CSP-blocked Clerk Google icon remain visible in browser.

## Decision

No-go for private beta checkpoint creation. The app is operational in public surfaces and route protection is correct, but the authenticated role matrix and provider readiness are not complete enough to call Beta V1 ready.