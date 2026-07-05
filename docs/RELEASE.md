# TETHER Release Checklist

Run before tagging a release:

```bash
npm run release:check
```

The release gate runs:

- private-boundary scan
- strict TypeScript typecheck
- unit, API, contract, storage, and E2E smoke tests
- dependency license audit
- `npm audit --audit-level=high`
- package dry-run inspection

Manual checks:

- Confirm GitHub repository license is detected as Apache License 2.0.
- Confirm open P0 release issues are closed or explicitly deferred.
- Confirm release notes mention migrations, known limitations, and compatibility impact.
- Confirm `npm pack --dry-run` contains no private harness, private docs, secrets, or local state.

## v0.2.0 Compatibility

No intentional breaking API changes from v0.1.0. The release adds JSON Schema boundary validation, so previously accepted unknown request fields now fail closed with `VALIDATION_FAILED`.
