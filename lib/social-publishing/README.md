# Social Publishing Foundation

This module is an owner-scoped, provider-neutral foundation for distributing canonical Nightly Hot Reels. It is intentionally disabled by default and does not claim that any external platform is supported until an official adapter and its server configuration are installed.

## Safety boundaries

- The `feature.social_publishing` flag is seeded disabled. The owner UI and every server action check the flag.
- Venue owners are the only authorized actors. Manager, Tech Operator, artist/DJ, consumer, and generic admin roles do not inherit social-account authority.
- Requests resolve Hot Reels from Nightly's database and verify venue, device service, privacy, review, expiry, and publication eligibility. Clients cannot submit media URLs, provider IDs, or actor identities.
- OAuth state is random, opaque, short-lived, DB-backed, hashed at rest, bound to a venue and Clerk actor, consumed once, and tied to one HTTPS callback URI. Requested/granted scopes are allowlisted and PKCE verifier material is stored only through `SocialCredentialStore`.
- Account rows contain a credential reference only. `UnconfiguredSocialCredentialStore` fails closed; no provider credentials are stored in this database.
- Destination jobs have per-venue idempotency constraints, account uniqueness, independent state, a bounded publish-attempt count, bounded provider-status polling, and durable retry timestamps. Provider idempotency lookup is required before retrying an uncertain remote publish.
- Signed Hot Reel playback URLs are server-generated for provider upload, short-lived, and never saved as canonical media identity or logged. Provider public URLs are HTTPS-normalized with query and fragment removed.
- `MockSocialPublishingProvider` is synthetic and cannot be selected in production. Real adapters must explicitly declare capabilities and normalize provider errors and statuses.

## Required adapter work before launch

Implement official OAuth and publishing adapters for each supported platform, register them with `registerSocialOAuthProvider`, implement the `SocialPublishingProvider` contract, configure a durable encrypted `SocialCredentialStore`, and configure the feature flag and platform app credentials in the server environment. The DB stores only opaque references and must not receive tokens or client secrets.

The currently available rate limiter is process-local. Use a shared/distributed limiter before enabling mutations on multiple application instances. Background execution is exposed as `runNextSocialDestination()` for a future bounded worker; no unbounded in-process queue is created here.

## Main services

`distribution-service.ts` owns DB-backed policy, account, distribution request, destination claim/retry, review, publish, revoke, and history operations. `auth.ts` derives identity from Clerk and DB membership. `oauth-security.ts` contains pure OAuth validation helpers suitable for deterministic tests. `credentials.ts` defines the server-side encrypted-store boundary and concurrency-safe versioned rotation contract.
