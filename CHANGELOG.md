# Changelog

## 0.2.0 - 2026-07-05

- Replaced the root license text with canonical Apache License 2.0 text for GitHub license detection.
- Added public JSON Schema contract artifacts and fail-closed HTTP request validation.
- Added `POST /v1/relationships/{relationshipId}/simulate` for deterministic non-mutating event simulation.
- Added migration rollback statements, migration rollback tests, and release governance scripts.
- Added Dockerfile, Docker Compose stack, and E2E smoke script.
- Fixed packaged API server entrypoint to import from `dist` instead of unpublished source files.
- Added public operations and release documentation.

## 0.1.0 - 2026-07-05

- Added relationship model validation and event application core flow.
- Added idempotent snapshot updates with explanations, audit events, and outbox events.
- Added development HTTP API and OpenAPI contract.
- Added private-boundary guard and public repository hygiene files.
- Restored strict TypeScript source, generated declarations, and typecheck verification.
- Added PostgreSQL persistence adapter with migrations and same-client transaction tests for idempotency, audit, and outbox writes.
