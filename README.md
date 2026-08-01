# Nightly

Nightly is a Next.js 16 platform for nightlife discovery, venue operations, bookings, ticketing, social crews, and admin controls.

## Local Development

1. Install dependencies:

```bash
npm ci
```

2. Copy environment values from `.env.example` into `.env.local`.

3. Run the app:

```bash
npm run dev
```

## Validation Commands

Run these before merging or deploying:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Environment Validation

Validate required runtime configuration:

```bash
npm run env:check
```

## Database Operational Commands

```bash
npm run db:status
npm run db:verify
npm run db:parity
npm run db:smoke
```

- `db:status`: database health and key table checks
- `db:verify`: migration ledger vs local migration drift detection
- `db:parity`: migration ledger and schema parity snapshot
- `db:smoke`: basic read-path smoke checks across core tables

## Security and Smoke Commands

```bash
npm run security:secret-scan
npm run security:deps-audit
npm run smoke:routes
```

## Google Venue Data Operations

```bash
npm run venues:google:audit
npm run venues:google:refresh -- --mode=stale_only --limit=25
npm run venues:google:backfill -- --limit=15
npm run venues:google:verify
```

- `venues:google:audit`: linked/unlinked/stale/failed venue data summary
- `venues:google:refresh`: manual Google data sync (single, batch, stale_only, failed_only)
- `venues:google:backfill`: candidate place matching for unlinked venues (confirmation still required)
- `venues:google:verify`: attribution and metadata coverage checks

## Health Endpoints

- `GET /api/health/live`: process liveness
- `GET /api/health`: service + database health
- `GET /api/health/ready`: launch readiness summary
- `GET /api/admin/health`: admin-only deep readiness report

## Security and Reliability Notes

- Webhook requests are verified and tracked in durable `webhook_deliveries` storage.
- Production logging uses structured JSON with automatic secret redaction.
- Owner Google Places search currently uses temporary in-memory rate-limiting and should be replaced with distributed infrastructure for full multi-instance protection.

## Runbooks

Launch readiness checklist: `docs/operations/launch-readiness.md`.
Google Places policy note: `docs/operations/google-places-policy.md`.
