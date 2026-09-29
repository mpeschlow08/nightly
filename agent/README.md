# Nightly Agent

Independent Node.js edge runtime for headless Linux Nightly Box devices. It runs outside Next.js and calls only the authenticated `/api/device/v1` Control Plane endpoints. Minimum supported runtime is Node.js 20.9.

## Scope

The Agent owns local lifecycle, one-time bootstrap, encrypted device-secret persistence, authenticated heartbeat/status/config synchronization, conservative capability/source discovery, commissioning reports, offline retry, structured redacted logs, systemd watchdog notification, and signed OTA manifest verification. OTA download, installation, or execution is deliberately not implemented. An opt-in local media foundation adds supervised capture, encrypted rolling segments, and deterministic local Hot Moment extraction. AI scoring, public publishing, cloud media upload, permanent recording, and remote live delivery are not implemented.

Hardware discovery is best-effort and reports `NOT_TESTED`, `NOT_AVAILABLE`, `UNSUPPORTED`, or `ERROR` when the host cannot prove a capability. ONVIF discovery sends a bounded WS-Discovery multicast Probe on the local link, parses bounded SOAP responses, and records safe endpoint/address/type/scope evidence. It does not authenticate to cameras or bind discovered devices to venue sources. RTSP support is a credential-free single-endpoint candidate and bounded `OPTIONS` reachability probe; a responding port is not an authenticated endpoint or validated stream. No password guessing, port-range scan, or broad subnet scan is performed.

Linux video nodes establish only V4L2 node presence, not HDMI identity, signal lock, resolution, or capture validity. ALSA enumeration does not prove input channel count, balanced XLR/TRS, or line-level electrical capability. A DRM render node or Intel vendor ID does not prove an encoder. When available, the Agent runs bounded `vainfo` against each render node and requires a codec profile and encode entrypoint on the same report line before setting H.264/HEVC VA-API encode support. Intel Quick Sync remains `NOT_TESTED` until a dedicated QSV runtime probe is available. TPM sealed-secret support is not implemented and never falls back to plaintext.

## Build And Test

From this directory, install the package's development dependencies, then run:

```powershell
npm install
npm test
npm run build
```

The package imports the shared device DTOs and validators as TypeScript-only dependencies from `../lib/nightly-device`; it does not import Next.js runtime modules.

## Provisioning

Set these values in `/etc/nightly-agent/agent.env` with root-only permissions:

```dotenv
NIGHTLY_CONTROL_PLANE_URL=https://your-control-plane.example
NIGHTLY_DEVICE_UUID=registered-device-uuid
NIGHTLY_SERIAL_NUMBER=registered-serial-number
NIGHTLY_AGENT_VERSION=0.1.0
NIGHTLY_BOX_SOFTWARE_VERSION=optional-box-image-version
NIGHTLY_AGENT_STATE_DIR=/var/lib/nightly-agent
```

Create a dedicated service account and directories, install the compiled `agent/dist` output under `/opt/nightly-agent/current/agent`, and provision two root-owned credential files with mode `0600`:

- `/etc/nightly-agent/bootstrap-token`: the one-time bootstrap token from device enrollment.
- `/etc/nightly-agent/credential-key`: base64 encoding of a cryptographically random 32-byte key. Generate and escrow it using the device provisioning system; do not commit it or put it in `agent.env`.

The service uses systemd `LoadCredential` to expose these only for the service lifetime. The returned device secret is AES-256-GCM encrypted under `/var/lib/nightly-agent/device-credential.enc`; the bootstrap token is never automatically retried when its outcome is ambiguous. Such devices enter `RECOVERY_REQUIRED` and require controlled reprovisioning. Replacing the credential key without decrypting/re-encrypting the stored secret makes recovery necessary.

Install `systemd/nightly-agent.service` under `/etc/systemd/system/`, review its user/group and hardware device permissions for the target image, then enable it with systemd. The unit is structurally covered by tests for user, restart/watchdog settings, state/config locations, video/audio/render group access, and hardening. It intentionally does not use `PrivateDevices=true`, which would hide the required hardware nodes. **TARGET LINUX VALIDATION REQUIRED**: run `systemd-analyze verify`, boot/restart/watchdog tests, and permission checks on the actual Linux/OEM image; Windows validation is not physical systemd certification.

## Simulation

Set `NIGHTLY_AGENT_SIMULATION=true` only in non-production. The deterministic simulation adapter reports empty inventory and `not_tested` checks labeled `SIMULATED`; the runtime does not write capabilities, inventory, or commissioning reports to the device Control Plane. Production configuration rejects simulation mode.

## Local Media Foundation

`src/media` uses the existing Agent process and device identity. Authenticated `/api/device/v1/config` delivers secret-free, device/venue-scoped canonical bindings and current privacy/service policy; `/api/device/v1/media-credentials` resolves only an assigned, enabled RTSP camera for an active operational device at the current revision. The CLI enables only these bindings, never discovery results. Credential URLs remain transient in memory and are excluded from Agent state, logs, and normal config. A config lease lasts at most five minutes, credential responses one minute; changes to camera source/status or Agent inventory rotate the revision. An unchanged inventory report does not rotate it. On denied access, revoked policy, or lease expiry, media stops. Inactive, mismatched, or ineligible sources fail closed. A reachable ONVIF or RTSP endpoint never grants content permission. Privacy masks are a required, unimplemented transform: mask-required sources cannot become publishable until a trusted resolver proves masks were applied.

Linux ingest is behind `MediaSupervisor`/`engine`: ffprobe discovers stream metadata; FFmpeg can capture explicitly bound RTSP, V4L2 `/dev/videoN`, or ALSA `hw:card,device` sources into short MPEG-TS segments **only on tmpfs**. The completed-segment list drives a bounded handoff into encrypted local storage. Normal source descriptors reject credential-bearing URLs; the short-lived, source-scoped RTSP URL with userinfo is supplied only as the ffprobe/FFmpeg input argument while the canonical source remains credential-free. This URL **is visible in the process argument list** to users with sufficient process inspection access while the process runs; sessions terminate before credential-response expiry. Operators must isolate the service account and restrict `/proc` visibility on the production image; do not treat process arguments as secret from privileged local users. Query-token and unsupported credential formats fail closed. Process startup, retries, memory queue, concurrency and forced shutdown are bounded; failures are source-local. VA-API requires supplied successful encode evidence; a detected Intel GPU alone cannot enable it. Unknown hardware uses bounded software encoding. ffmpeg/ffprobe, `/dev/shm`, V4L2/ALSA permissions, actual camera interoperability and sustained encode/thermal behavior require target-Linux validation. The simulation harness uses generated bytes and does not claim FFmpeg or physical capture PASS.

Media is stored under the injected Agent state directory in `segments/` and `moments/`, separate from cloud DB and the small Agent lifecycle state file. AES-256-GCM encrypts each payload and authenticated local index/journal, using a per-device key provider such as the existing systemd `credential-key`; no key lives beside footage in plaintext. Key-version metadata is present, but rotating an active key requires a controlled re-encryption/recovery workflow not yet implemented. Opaque names, atomic 0600 writes, a conservative five-minute rolling default, byte/count/per-source quotas, a 128 MiB disk reserve, one-hour maximum protected-object lifetime, and startup reconciliation bound local data. The ffmpeg tmpfs intermediary is volatile plaintext and must not be redirected to persistent disk. Media availability is lost on unclean key replacement; fail closed rather than silently replacing a lost index.

Hot Moment candidates accept manual, synthetic and commissioning triggers through the same privacy gate; they wait a bounded time for post-roll, track actual segment coverage (partial is not complete), verify integrity, and store encrypted local objects. `FfmpegMp4Muxer` consumes decrypted segments in a private tmpfs workspace, validates bounded MP4 output with ffprobe, and deletes plaintext on completion/failure; startup recovers abandoned workspaces. The deterministic simulation muxer remains for offline tests. The muxer has injected-runner tests but real FFmpeg on the target Linux image is NOT_TESTED. Segment timing prefers bounded ffprobe evidence from encoded MPEG-TS PTS; wall time and uncertainty are approximations, not source-frame synchronization. Multi-source synchronization and actual clip-frame precision remain NOT_TESTED. Cloud upload, UI, AI scoring, and a full NVR are outside this sprint.

## OTA Foundation

`verifyUpdateManifest` verifies an Ed25519 signature over the canonical manifest fields, an HTTPS URL, a SHA-256 digest shape, and a validity window. It does not fetch, unpack, replace, or execute artifacts. A future installer must add artifact digest verification, rollback protection, A/B or equivalent recovery, and an operator-controlled rollout policy before updates can be applied.