# Nightly Operations Runbooks

## Deploy

- Run `npm run env:check`, `npm run db:verify`, `npm run db:status`, `npm run db:parity`, `npm run db:smoke`.
- Run `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.
- Apply migrations with `npm run db:migrate`.
- Verify `GET /api/health/live` and `GET /api/health/ready`.
- Confirm `/admin/launch-readiness` is `GO` before promotion.

## Rollback

- Roll back application artifact to previous release.
- Keep database forward-safe whenever possible.
- If rollback requires schema rollback, stop traffic first and validate foreign key impact.
- Record rollback in `platform_release_records`.

## Failed migration

- Stop deploy promotion.
- Run `npm run db:status` and `npm run db:verify`.
- Compare local drizzle files with `drizzle.__drizzle_migrations`.
- Do not auto-repair production; use reviewed SQL and manual approvals.

## Database outage

- Mark incident category `database` severity based on blast radius.
- Switch user-facing status to degraded and pause write-heavy operations if needed.
- Confirm Neon status and connectivity.
- Resume only after `db:status` is healthy and smoke routes pass.

## Clerk outage

- Mark incident category `authentication`.
- Disable privileged admin mutations.
- Keep public read routes alive where possible.
- Resume when Clerk provider check is no longer degraded/unavailable.

## Payment outage

- Trigger payment kill switch flag.
- Block new checkout attempts with clear messaging.
- Preserve existing orders and reconciliation events.
- Resume after webhook confirmation and reconciliation checks.

## Notification outage

- Pause notification fan-out jobs.
- Keep outbox entries queued.
- Resume by replaying queued deliveries in controlled batches.

## Blob outage

- Disable new media uploads.
- Preserve existing references.
- Queue retry jobs for failed writes.

## Google Places outage

- Use Google Places kill switch.
- Keep owner portal editable without import actions.

## AI-provider outage

- Disable concierge/AI capability flags.
- Return provider-unavailable responses, never silent fake success.

## Realtime outage

- Disable presence-related writes and show stale-safe client messaging.
- Keep core flows operational without realtime dependency.

## Ticket scanner outage

- Disable scan mutations if validation is unstable.
- Allow manual check-in fallback by authorized door staff with audit logs.

## Oversold event

- Freeze further ticket issuance for affected event.
- Notify operations/admin and create incident timeline.
- Prioritize refund and communication workflow.

## Compromised admin account

- Suspend impacted account and revoke assignments.
- Rotate privileged secrets and review admin audit events.
- Force re-verification for related admin users.

## Secret rotation

- Rotate provider keys in secret manager.
- Update environment values and re-run `env:check` and readiness endpoints.
- Validate webhook signatures and signing secrets after rotation.

## Event cancellation

- Update lifecycle status.
- Trigger outbox notifications and refund workflow where applicable.
- Record all actions in audit and incident logs.

## Refund incident

- Disable refund mutations if integrity is at risk.
- Reconcile provider records before resuming.

## Feature kill switch

- Toggle relevant `platform_feature_flags` kill switch.
- Verify API-level enforcement path is active.
- Record reason and actor in admin audit.

## Privacy request

- Create or update `privacy_requests` record.
- Route through legal review if required.
- Keep protected financial/legal retention data untouched.

## Backup restore verification

- Run controlled restore verification in non-production environment.
- Record result in `platform_backup_verifications`.
- Confirm parity and smoke checks before closeout.

## Incident communication

- Use one incident commander.
- Publish periodic updates with impact, status, and next update time.
- Include remediation and follow-up actions after resolution.
