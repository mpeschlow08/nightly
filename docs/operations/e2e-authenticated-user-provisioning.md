# Authenticated Beta E2E Identity Provisioning

This runbook is development-only and must never be executed against production, preview, or staging environments.

## Required environment variables

Set these in .env.local:

- E2E_CONSUMER_EMAIL
- E2E_DJ_EMAIL
- E2E_OWNER_EMAIL
- E2E_ADMIN_EMAIL
- E2E_LIMITED_ADMIN_EMAIL
- E2E_DOOR_EMAIL (only when ticket scanning is enabled)

## Commands

1. Check readiness:

npm run e2e:users:status

2. Provision Clerk development users (idempotent):

npm run e2e:users:provision

3. Link Nightly DB records and fixtures (idempotent):

npm run e2e:users:link

4. Verify complete identity and fixture graph:

npm run e2e:users:verify

## Manual fallback (only if Clerk API provisioning fails)

1. Open Clerk dashboard for the development instance.
2. Create each missing identity using the configured E2E_* email.
3. Mark accounts as development test users in metadata.
4. Re-run:

npm run e2e:users:link
npm run e2e:users:verify

## Safety controls

- No credentials are hardcoded.
- Passwords and tokens are never printed.
- Scripts exit immediately in production-like environments.
- Test fixtures are labeled and deterministic.
- Existing non-test records are not deleted.
