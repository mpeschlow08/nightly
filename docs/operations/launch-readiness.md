# Launch Readiness Checklist

## Runtime

- Confirm `APP_ENV` and `NEXT_PUBLIC_APP_ENV` reflect the target environment.
- Run `npm run env:check` and verify all required variables are configured.
- Ensure production secrets are injected through the deployment platform only.

## Database

- Run migrations with `npx drizzle-kit migrate`.
- Run `npm run db:status` and verify `status` is `healthy` or `degraded` (never `unavailable`).
- Run `npm run db:parity` and confirm migration ledger count is current.
- Run `npm run db:smoke` and verify it returns `ok: true`.

## API Health

- Check `GET /api/live` returns HTTP 200.
- Check `GET /api/health` returns HTTP 200 (or investigate immediately).
- Check `GET /api/ready` returns HTTP 200 for launch readiness.
- Check `GET /api/admin/health` using an admin account with `health:view` permission.

## Security

- Verify Clerk webhook secret is configured.
- Confirm webhook retries are visible in `webhook_deliveries`.
- Confirm ticket and social token secrets are rotated and stored securely.

## Deployment Validation

- Run `npm run lint`.
- Run `npx tsc --noEmit`.
- Run `npm test`.
- Run `npm run build`.
- Perform authenticated smoke tests for critical owner, DJ, and admin flows.

## Rollback Plan

- Keep previous deployment artifact available.
- Keep previous migration snapshot and verified backup.
- If launch regression occurs, roll back deployment first, then evaluate data roll-forward safety before DB rollback.
