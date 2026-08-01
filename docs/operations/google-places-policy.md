# Google Places Data Policy (Nightly)

This sprint uses Google Places API (New) with explicit field masks and server-side requests only.

## Data Boundaries

- Google-provided fields in Nightly: venue identity, address, contact details, hours, rating metadata, and public photo metadata.
- Nightly/owner-managed fields: live crowd indicators, cover details, events, DJ lineup, social activity, and booking state.
- Nightly does not claim Google provides real-time crowd, cover, DJ, event, or social-post data.

## Photo Handling

- Stable key stored: Google Place ID.
- Photo resource names are treated as refreshable metadata, not permanent identifiers.
- Google photos are delivered through server proxy routes to avoid exposing API keys.
- Owner-uploaded photos remain in Blob and retain highest priority.
- Google photo media is not permanently republished to Blob by default.

## Refresh and Ownership

- Owner overrides are preserved and are not silently overwritten by Google refresh.
- Refresh runs are recorded with per-venue outcomes and error summaries.
- If scheduler integration is not configured, refresh is run manually through owner/admin controls or scripts.

## Cost and Safety

- Explicit field masks are used for Search and Details requests.
- No wildcard field masks are used.
- Batch and stale-only refresh modes are supported to limit request volume.
- Secrets (API keys) are never logged and never sent to the browser.
