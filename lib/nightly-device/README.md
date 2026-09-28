# Nightly Device Foundation

This module establishes the Sprint 1 Nightly Box control plane foundation without implementing the Linux agent or live edge runtime.

## Scope

- device lifecycle and provisioning states
- capability validation that rejects secrets and raw credentials
- hashed one-time bootstrap and owner claim credentials
- authenticated `/api/device/v1` enrollment, heartbeat, status, configuration, capability, inventory, and claim routes
- venue-scoped owner and delegated Tech Operator authorization using existing venue membership and staff permissions
- capture source records that reference existing `venue_cameras` for IP cameras
- conservative typed service/privacy fields and evidence-backed commissioning checks
- a minimal owner VenueOS Nightly Box status and commissioning view

## Explicitly deferred

- actual Linux Nightly Agent runtime
- RTSP/ONVIF discovery and camera control
- HDMI capture runtime and mixer/line-audio ingest
- rolling buffer implementation
- full Hot Reel or social publishing orchestration
- device fleet administration beyond protected enrollment
- runtime commissioning probes; absent results remain `NOT TESTED`
