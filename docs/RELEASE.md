# TETHER Release Checklist

Run before tagging a release:

```bash
npm run release:check
```

The release gate runs:

- private-boundary scan
- strict TypeScript typecheck
- unit, API, contract, storage, PostgreSQL HTTP runtime E2E, and E2E smoke tests
- dependency license audit
- `npm audit --audit-level=high`
- package dry-run inspection

Manual checks:

- Confirm GitHub repository license is detected as Apache License 2.0.
- Confirm open P0 release issues are closed or explicitly deferred.
- Confirm release notes mention migrations, known limitations, and compatibility impact.
- Confirm `npm pack --dry-run` contains no private harness, private docs, secrets, or local state.

## TETHER v2.0.0 Compatibility

2.0.0 removes `createDefaultApiRuntime()`, implicit HTTP runtime defaults, and the development bearer-token path. Consumers must configure `TETHER_RUNTIME_STORE`, `TETHER_BIND_HOST`, and `TETHER_AUTH_ADAPTER`; PostgreSQL deployments must also set `DATABASE_URL` and `TETHER_MIGRATE_POSTGRES=1`. Auth adapters must return a tenant matching `X-Tenant-Id`. The `/v1` HTTP routes and JSON Schema validation behavior remain compatible. Confirm production traffic gates use `/ready`; `/health` is liveness-only.
