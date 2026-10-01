# Nightly Device Foundation

## Model summary

The Nightly Box is modeled as a first-class device entity alongside the existing venue and camera architecture. It does not replace the current `venue_cameras` system; instead, the new device layer is designed to sit above it and add ownership, lifecycle, provisioning, and claim semantics that future Nightly Agent workflows will depend on.

## Lifecycle states

Nightly devices use explicit lifecycle states instead of ambiguous booleans. The current foundation includes:

- `factory`
- `inventory`
- `provisioned`
- `unclaimed`
- `claimed`
- `active`
- `degraded`
- `offline`
- `suspended`
- `return_pending`
- `rma`
- `revoked`
- `reprovisioning`
- `retired`

These states provide an explicit boundary for future fleet operations and service management without overcomplicating the VenueOS interface.

## Identity and security assumptions

The serial number and public device UUID are identifiers, not credentials. An active administrator enrolls each device with its own random one-time bootstrap token. The bootstrap token is stored as a hash and exchanged once for a random device bearer secret, also stored only as a hash. Device API requests require both the public UUID header and the device bearer secret. There is no shared fleet credential, and device credentials do not authenticate owner or consumer APIs.

## Claim flow foundation

Owners generate high-entropy, one-time claim codes in the VenueOS browser. The server receives the code only to hash it; the issue response contains only its expiry. Codes expire after 30 minutes. Redemption checks the same venue and issuing owner, locks the device and claim rows, conditionally consumes the pending claim, creates assignment history, and writes an audit event in the same transaction. A failed bind rolls the transaction back. Legacy plaintext claims are revoked and removed by the completion migration.

## Capability model

Capabilities are expressed as structured records with a category, label, and boolean or scalar value. This keeps the schema extensible without dissolving into arbitrary JSON dumps. Sensitive fields such as tokens, passwords, SSIDs, and credential-bearing metadata are rejected before they can enter the model.

## Privacy and outage boundaries

The design keeps privacy decisions explicit and conservative. It does not assume a connected camera is public and it preserves privacy controls as first-class system concerns. Cloud outage behavior is represented as a policy boundary that supports local continuing operations, queued candidate media, and later resynchronization when connectivity returns.

## Service entitlement separation

The service-management and customer-service domains are explicitly separated. Nightly retains ownership of leased devices, while the subscription/service layer can disable commercial functionality without destructively bricking the hardware. That allows RMA, wipe, reprovision, and recovery flows without degrading the underlying device lease model.

## Capture sources

`nightly_device_sources` models IP camera, HDMI input, mixer audio, ambient audio, and extensible future source categories. IP camera sources reference the existing `venue_cameras` row; camera URLs, provider IDs, and credentials are not duplicated in the device source record. Database constraints require that link for IP cameras and prohibit it for non-camera inputs.

## Service, privacy, and commissioning

Service entitlement, suspension time, Nightly management/recovery eligibility, content eligibility, Hot Reel eligibility, live eligibility, public publishing eligibility, privacy mode, and privacy revision are explicit fields. New devices default to inactive service, private privacy, restricted content, and no public, Hot Reel, or live eligibility. Management recovery remains a distinct flag and can remain available while customer service is suspended; revoked and retired devices have neither.

Commissioning checks cover Cameras, Audio, HDMI, Hardware Acceleration, Storage, Internet, and Nightly Cloud. Missing check records render as `NOT TESTED`. The database rejects PASS, WARNING, or FAIL records without a timestamp and evidence payload; this sprint does not synthesize test results.

## API and operator experience

The versioned routes live under `/api/device/v1`: `enroll`, `bootstrap`, `heartbeat`, `status`, `config`, `capabilities`, `inventory`, `claim-codes`, and `claim`. Enrollment is active-admin-only. Device routes use the per-device bearer credential. Owner claim actions use Clerk venue membership; active staff with the existing `nightly_device:operate` permission can view the scoped VenueOS summary but cannot issue claims or perform lifecycle actions. The management page is `/owner/devices`.

## Sprint 8 fleet software boundary

`evaluateFleetState` in `lib/nightly-device/policy.ts` derives connectivity from server-received heartbeat time: online through 2 minutes, stale through 5 minutes, then offline. It keeps commercial state separate from operational health; suspension/maintenance without failure evidence does not become hardware-critical. The device status route, Admin Fleet list/detail and Owner device page use this evaluator and persist no additional mutable fleet-status column. `evaluateCommissioning` combines persisted checks, assignment, heartbeat, enrolled sources, config sync and explicit capture/rolling-buffer evidence into resumable steps. A recorded PASS alone does not prove actual capture: `captureValidated` and `rollingBufferReady` evidence must both be true before READY. Existing Linux probes do not yet assert either without verification, so readiness remains conservative.

The optional heartbeat `telemetry` payload is schema version 1 with measured uptime, total/available memory and applied config revision. Bounded optional storage, camera, upload-queue and restart counters are accepted only when actual measurements exist. Unknown fields, inconsistent ranges and request bodies over 4096 bytes are rejected. The Agent sends the measured OS subset on its existing authenticated heartbeat; it does not infer optional hardware metrics. Migration `0036_fleet_operations_foundation` was applied to verified Development; one row per device stores the latest snapshot only. Raw logs, credentials, environment and media never belong in telemetry.

Migration 0036 also defines deduplicated active alerts, expiring scoped support grants and idempotent typed operation records. Memory/storage/camera/upload conditions require measured values. Commercial suspension is informational rather than hardware failure. Heartbeats resolve offline alerts, including from older Agents without telemetry; a real offline-to-online recovery produces one resolved `DEVICE_RECONNECTED` event. The partial unique index prevents duplicate active alerts, while resolved alerts remain historical. Latest snapshots are single-row; retention removes resolved alerts and terminal operations after 30 days in batches of up to 500 for at most 100 selected devices, then unused expired grants. Existing platform audit retention is separate.

The production-callable `POST /api/admin/fleet/sweep` uses a dedicated server-only `NIGHTLY_FLEET_SWEEP_TOKEN` (32–128 base64url characters), never a device or owner credential. It accepts a bounded JSON `{ "requestId": "<uuid>", "cursor": 0, "limit": 100 }` and returns `nextCursor`; callers repeat until it is null. `deviceIds` is an optional at-most-100 unique-ID target for scoped support/certification. The route rejects unauthorized requests before DB work, uses a transaction-scoped advisory lock (concurrent runs receive 409), reconciles offline/recovered alerts without incrementing repeat observations, prunes bounded history, and audits each processed batch by request ID. A scheduler provider is not selected or deployed; operators may also invoke the existing `jobs:manage` selected-device controls. For production operation, configure a scheduler to call every cursor page on a recurring interval with its dedicated secret. Do not use a global unbounded scan in one request.

Admin Fleet uses `health:view`; support grants, alert acknowledgement and health-check requests require `support:resolve`. Grants bind actor, Box, scope and a 15-minute expiry, are revocable, and are audited. The only delivered remote operation is read-only `REQUEST_HEALTH_CHECK`, polled outbound over device authentication, acknowledged conditionally, and constrained to its grant lifetime. Simulation cannot report hardware success; support expiry does not interrupt capture. Owner/Tech may request only a venue-bound recheck under a short server-issued grant; duplicate retries within five minutes do not create new operations. The diagnostics endpoint requires a live diagnostics grant, same-origin POST, locked revalidation and a durable per-Box limit of 30 reads in 15 minutes; it returns only allowlisted current data. A separate bundle grant allows up to three 16KB JSON bundles per Box in 15 minutes, each with 15-minute expiry metadata; bundles are not retained server-side. No arbitrary shell, restart or update execution exists.

Migration `0037_fleet_update_rollout_foundation` adds explicit, canary-targeted OTA rollouts and per-Box lifecycle history. Development is 38/38 migrations, 227 public tables, zero pending, no drift. Canary scheduling is limited to five Boxes, requires `jobs:manage`, a configured trusted `NIGHTLY_OTA_PUBLIC_KEY`, a signature covering the hardware-model list, compatible Box model, and a newer semver version. Repeated identical active scheduling is a no-op; conflicting active targets fail. An internal row-locked lifecycle transition enforces expected-state compare-and-set, keeps failure reason through recovery, audits accepted changes, and requires explicit signature, health and rollback evidence flags. Test-only ephemeral Ed25519 keys certify that software path; no private production signing key is in the repository. The Agent still does not download or install OTA packages, and neither a simulated rollback nor a database state proves physical recovery.

**Deferred physical certification:** Representative Nightly Box hardware is required to prove authenticated camera capture, balanced program/ambient audio, real encoder behavior and thermals, rolling-buffer endurance, and physical OTA installation/rollback. The software evaluator refuses READY without capture/rolling-buffer evidence. These hardware proofs belong to the later appliance prototype/torture-certification phase, not an invented Sprint 8 result. A production scheduler deployment and release-signing/install pipeline are also separate deployment work; no fleet-wide auto-update is enabled.

## Original device-model phase deferrals

The original device-model phase deferred the Linux Agent, actual RTSP/ONVIF/HDMI/audio capture, runtime commissioning probes, rolling buffer engine, full media archive, Hot Moment runtime, social publishing runtime, and NVR. Later foundations implemented some of those systems; the physical verification still deferred for Sprint 8 is specified above. The device layer remains additive and does not replace the existing Mux/Cloudflare live-streaming provider architecture, reservations, Google Places, Concierge, Special Guest, or existing Wow Phase UI.
