# Release Management

## Required release metadata

- Version
- Commit hash
- Environment
- Migration status
- Feature-flag snapshot
- Provider status snapshot
- Known issues
- Smoke-test result
- Approver
- Go/No-Go decision
- Rollback instructions

## Recording a release

- Set environment values:
  - `RELEASE_VERSION`
  - `RELEASE_COMMIT`
  - `RELEASE_MIGRATION_STATUS`
  - `RELEASE_GO_NO_GO`
  - `RELEASE_SMOKE_STATUS`
  - Optional JSON fields for flags/providers/issues
- Run `npm run release:record`.
- Validate record appears in `platform_release_records`.

## Post-deploy verification

- Run `npm run db:verify` and `npm run db:status`.
- Run `npm run smoke:routes` against deployed URL.
- Check `/admin/launch-readiness` for blockers.
