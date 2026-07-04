# TETHER

TETHER is a small TypeScript foundation for compiling a versioned Persona Contract into a deterministic CompiledBundle.

The current MVP focuses on a local, model-independent compiler:

- validates a JSON Persona Contract at the trust boundary;
- requires explicit policy references;
- rejects unknown or incompatible plugin references fail-closed;
- compiles only published versions;
- canonicalizes JSON before hashing;
- emits source/provenance metadata and a stable SHA-256 content hash.

## Non-goals

- No chat UI.
- No model inference.
- No emotional scoring or dependency optimization.
- No hidden prompt mutation after compilation.

## Quick Start

```bash
npm install
npm run verify
npm run build
node dist/cli.js --input examples/persona-contract.json --compiler-version 0.1.0 --generated-at 2026-07-05T00:00:00.000Z
```

## Library Usage

```ts
import { compilePersonaVersion, parsePersonaContract } from "@tuzuminami/tether";

const contract = parsePersonaContract({
  id: "persona-demo",
  version: "1.0.0",
  displayName: "Demo Persona",
  components: [{ id: "style", kind: "style", content: "Use concise wording." }],
  policyRefs: ["policy://default/conversation-boundaries"]
});

const bundle = compilePersonaVersion(
  { contract, status: "published" },
  { compilerVersion: "0.1.0", generatedAt: "2026-07-05T00:00:00.000Z" }
);
```

## Development

```bash
npm run check:private-boundary
npm run build
npm test
```

`npm run check:private-boundary` is a conservative public-repository guard. It rejects tracked or staged private operator files, private planning filenames, private markers, `.env` files, local database dumps, and private fixture directories.

## Security Notes

This MVP stores no secrets and makes no outbound network calls. Plugin manifests are plain compatibility declarations. Unknown plugin references stop compilation instead of being ignored.

## License

Apache-2.0. See [LICENSE.md](LICENSE.md).
