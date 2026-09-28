# Nightly Agent

Independent Node.js edge runtime for headless Linux Nightly Box devices. It runs outside Next.js and calls only the authenticated `/api/device/v1` Control Plane endpoints. Minimum supported runtime is Node.js 20.9.

## Scope

The Agent owns local lifecycle, one-time bootstrap, encrypted device-secret persistence, authenticated heartbeat/status/config synchronization, conservative capability/source discovery, commissioning reports, offline retry, structured redacted logs, systemd watchdog notification, and signed OTA manifest verification. OTA download, installation, or execution is deliberately not implemented. The Agent does not implement media capture, encoding, switching, rolling buffers, Hot Moments, AI Director, public publishing, or remote live features.

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

## OTA Foundation

`verifyUpdateManifest` verifies an Ed25519 signature over the canonical manifest fields, an HTTPS URL, a SHA-256 digest shape, and a validity window. It does not fetch, unpack, replace, or execute artifacts. A future installer must add artifact digest verification, rollback protection, A/B or equivalent recovery, and an operator-controlled rollout policy before updates can be applied.