# Contributing

Thanks for helping improve TETHER.

## Local Checks

```bash
npm run verify
```

## Public Material Only

Do not commit private planning documents, local operator notes, `.env` files, production logs, database dumps, raw conversation exports, or private fixtures. The repository guard rejects common accidental leaks.

## Design Expectations

- Keep domain logic separate from transport and storage adapters.
- Validate untrusted input at boundaries.
- Preserve tenant isolation and idempotency semantics.
- Add tests for success and safe failure behavior.
- Keep public documentation focused on released behavior.
