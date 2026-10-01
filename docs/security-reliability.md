# Security and Reliability Boundaries

## Trust boundaries

Nightly treats browser clients, venue networks, Nightly Boxes, and provider callbacks as untrusted. Server-derived Clerk identity, active database relationships, and scoped database records are authoritative. Client-supplied user, role, venue, organization, device, pricing, and entitlement fields are not authority.

## Tenant and role isolation

Venue objects are authorized through the current actor's active venue membership or an explicit administrator permission. Owners retain venue and commercial authority. Managers and delegated Tech Operators receive only the operations explicitly granted to them. Consumers, artists, devices, and service actors do not authenticate as one another. Object queries should include the actor's tenant predicate and return generic denial when existence is not needed.

## Device trust

Serial numbers, QR values, and public device UUIDs identify devices but do not authenticate them. Enrollment and bootstrap use bounded, one-time values; normal device APIs require the device-specific bearer secret and matching public UUID. Device secrets are stored as hashes. Revoked devices lose normal service and management access, while separately authorized recovery can remain available for return, wipe, and reprovisioning. Device operations are allowlisted, device-bound, grant-bound, expiring, and idempotent. No arbitrary shell or shared fleet password is supported.

## Commercial and media enforcement

Commercial capability is evaluated at the final action boundary. Venue suspension disables prohibited public and commercial output while retaining only explicitly permitted management paths. Hot Reel playback validates the media, venue, device, privacy, publication, and entitlement state before consuming a free allowance. Storage references and camera credentials remain server/device scoped; consumers do not receive raw storage or camera credentials.

## OAuth and publishing

OAuth state is opaque, hashed at rest, short-lived, actor- and venue-bound, and single-use. Redirects and requested scopes are allowlisted, with PKCE where supported. Provider publication rechecks authorization, media eligibility, entitlement, kill-switch state, venue state, and destination ownership immediately before the provider call. Provider work is idempotent and does not run inside a long database transaction.

## Replay, input, and failure handling

Important mutations use durable uniqueness, row locks, compare-and-set transitions, or idempotency fingerprints. Request bodies, lists, telemetry, diagnostic reads, and support bundles are bounded and allowlisted. Retries are bounded and stale terminal results cannot overwrite completed state. Errors returned to clients and structured logs must not contain credentials, connection strings, signed URLs, or stack traces.

## Environment isolation

Development database mutation tooling must positively identify the pinned Development project, branch, endpoint, and database before changing data. The Production endpoint `ep-rough-mud-atcx5jvx` is forbidden in certification tooling. Certification fixtures use exact run prefixes and must clean up to zero. `.env.local` remains ignored and is never part of repository secret scanning.

## Audit expectations

Sensitive authorization, device, support, commercial, publication, and lifecycle changes should be auditable with actor, scope, action, and safe metadata. Audit metadata must be allowlisted and redacted; secrets and raw provider payloads do not belong in audit rows.

## Physical certification deferred

Software tests do not prove Secure Boot on production hardware, TPM behavior, disk extraction resistance, chassis tamper resistance, thermal endurance, NIC isolation, factory provisioning, or physical OTA installation and rollback. Those claims require representative Nightly Box hardware and remain deferred to the physical appliance certification sprint.
