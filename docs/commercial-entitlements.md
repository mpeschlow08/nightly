# Commercial Entitlements

Nightly Sprint 7 introduces server-authoritative commercial access without a payment processor. Subscription state, scoped manual grants, service authorizations, consumer daily unlocks, and device directives are stored in the application database. Missing subscription records deny access; existing venue/device rows are not backfilled into commercial subscriptions.

## Products and Scope

- `venue_package` is one all-inclusive package scoped to a venue. Its capability catalog includes Venue OS, Hot Reels, AI Director, Social Publishing, Artist sessions, analytics, remote media, and device capabilities. No venue price is exposed.
- `consumer_premium` is scoped to a consumer user. The 999-cent target is metadata only; no checkout, billing, or payment processor is implemented. First entitlement access creates one 30-day trial anchored to the account creation timestamp. A delayed first visit cannot extend the trial.
- `artist_subscription` is scoped to the DJ profile and remains separate from Consumer Premium and venue access.
- Organization scope is reserved and defaults to deny until a canonical organization model exists.

All access checks use `lib/commercial-entitlements/service.ts`. User IDs and scope IDs are resolved on the server; request bodies do not supply entitlement booleans. Admin state transitions, manual grants, and service authorizations are audited. Manual grants are capability-scoped, expiring, and revocable.

## Consumer Hot Reels

Premium access provides unlimited venue Hot Reel unlocks. A non-Premium consumer may unlock the same venue repeatedly for a given UTC calendar day; the unique consumer/date record prevents unlocking a second venue that day. Unlock creation and audit are transactional. The venue must have active `venue.hot_reels` access and eligible published content. The consumer API derives the user from Clerk and accepts only a venue ID.

## Device Policy

Device directives are projected from the venue subscription and applicable venue/device grants. Device management remains independent of paid media capability. Paid capture requires `device.capture`; Hot Reel and live eligibility require their specific venue/device capabilities. The Agent validates directive identity and revisions, rejects same-revision capability broadening, accepts safe narrowing, keeps authorization in memory, and stops paid media at directive expiry. Offline authorization is bounded by `NIGHTLY_DEVICE_OFFLINE_ENTITLEMENT_HOURS` (default 72 hours; valid configured range 1-168 hours).

A venue moderation/lifecycle block is reported as scope unavailability, not as a commercial subscription suspension. It removes paid capabilities while preserving the actual subscription state for status reporting.

## Service Authorization

Admin-issued service authorizations bind an active actor, venue/device scope, purpose, capability set, issue/expiry window, and revocation state. They expire within 24 hours and do not store or return bearer credentials. Evaluation must match the authenticated actor, scope, capability, purpose, and authorization ID. The database and application both constrain purpose-to-capability combinations.

## Migration and Operations

Migration `0035_commercial_entitlement_foundation` creates the entitlement, grant, service-authorization, and daily unlock tables. It intentionally performs no subscription or device backfill. Apply it only to the verified Development Neon endpoint after confirming the exact project, branch, endpoint, and latest applied migration. Production migration is prohibited for this Sprint 7 task. Sprint 6 migrations `0033` and `0034` remain unchanged.
