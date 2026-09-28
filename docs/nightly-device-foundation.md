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

## Deferred implementation

This sprint intentionally does not build the Linux Nightly Agent, actual RTSP/ONVIF/HDMI/audio capture, runtime commissioning probes, rolling buffer engine, full media archive, Hot Moment runtime, social publishing runtime, or NVR. The device layer is additive and does not replace the existing Mux/Cloudflare live-streaming provider architecture, reservations, Google Places, Concierge, Special Guest, or existing Wow Phase UI.
