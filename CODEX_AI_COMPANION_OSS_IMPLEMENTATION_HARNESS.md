# AI Companion OSS Portfolio — Private Control Plane and Codex Implementation Harness

> **Edition**: `2026-07-04-r2` — local-only operator control plane / public-repository firewall / seven independent GitHub repositories and Codex projects.
> **Updated**: 2026-07-04 (Asia/Tokyo). This revision makes the private harness and original requirements corpus external-only by default, and makes repository independence a release gate.
>
> **Purpose**: This file is the private, local-only operating brief for Codex when implementing one of seven independent commercial-friendly OSS repositories for model-agnostic conversational AI and AI-companion systems. It has no artificial word, character, or token ceiling: retain the specificity needed for reliable implementation, verification, and publication control. It is not source code, public documentation, or a file intended to ship with any repository.
>
> **Private-use rule**: This harness, the original requirement-definition document set, internal execution ledgers, traceability maps, strategic research, and private ADRs are **operator material**. They must remain outside every Git working tree and must never be committed, pushed, attached to releases, published to GitHub, included in packages/images, copied into public issues/PRs, or reproduced in public documentation. A public OSS repository contains only code and deliberately curated public-safe documentation.
>
> **Use**: Keep this file in a local private control plane, not at a repository root. At the beginning of each Codex session, provide the absolute local path and instruct Codex: **“Read the private harness at `<PRIVATE_HARNESS>` in full. It is governing implementation context, but it is non-public operator material. Do not copy, quote, commit, or publish it. Execute the selected project and mode.”**
>
> **Language policy**: Source code, identifiers, API paths, OpenAPI descriptions, commit messages, and end-user OSS documentation are English. User-facing implementation reports may be Japanese unless asked otherwise. Product localization is performed by the application/LLM layer; core domain behavior must not depend on a human language.
>
> **Status**: Product strategy and repository scope baseline. This is not legal advice, a safety certification, or a claim that every cited market premise has been independently revalidated in the current implementation session. Treat external facts, third-party licenses, provider APIs, and regulations as items to verify from primary sources before relying on them.
>
> **Portfolio topology — mandatory**: ASTER, MORROW, TETHER, VEIL, DRIFT, RELAY, and PULSE are seven separate public GitHub repositories. This harness and the complete requirements corpus are local private operator material. They are not an eighth repository, are not a GitHub repository, and are never vendored, mirrored, mounted, submoduled, copied, or published into any of the seven repositories.

---

## 0. Private Control Plane and Session Input

### 0.0 Owner operating decision — enforce before every Codex session

The operator has explicitly chosen this topology. Treat it as a binding implementation constraint, not a suggestion:

- **Private control plane:** This harness, all requirement-definition documents, research, private ADRs, traceability, execution ledgers, test evidence, and local Codex prompts remain outside every public Git working tree and outside every GitHub publication surface.
- **Seven independent public products:** `ASTER`, `MORROW`, `TETHER`, `VEIL`, `DRIFT`, `RELAY`, and `PULSE` are separate GitHub repositories. Each has its own Codex project, repository root, dependency graph, CI, issue tracker, package/release identity, and security boundary.
- **One session, one repository:** Each Codex session selects exactly one project and may change only that project’s public repository plus the corresponding local private work/evidence area. Sibling repositories are unavailable by default.
- **No hidden coupling:** Do not use a monorepo, `workspace:*`, `file:` references, symlinks, shared schemas/databases, copied source, private submodules, or unversioned local packages to connect projects. Cross-project compatibility is proven through released public contracts and separately scoped integration work.
- **External-path failure behavior:** If Codex cannot read a required private artifact from its external local path, stop and request read-only access or a deliberately redacted task brief. Never copy private material into the repository to work around a sandbox or workspace restriction.
- **No publication by default:** A commit, push, pull request, tag, package publication, image publication, or GitHub release requires a distinct current-session instruction and the full privacy preflight. Passing tests never implies permission to publish.

### 0.1 Non-public artifact boundary — highest implementation invariant

This portfolio intentionally separates **private decision context** from **public OSS deliverables**.

The private materials include, at minimum:

- This harness and every local variant of it.
- The complete requirement-definition corpus: `00_GLOSSARY.md`, `01_BMA.md`, `02_StRS.md`, `03_SyRS.md`, `04_AD.md`, `05_DD.md`, `06_API_CONTRACT.md`, `07_VV_PLAN.md`, `08_TRACEABILITY.md`, `09_MVP_BACKLOG.md`, and `10_RELEASE_CRITERIA.md`.
- Internal strategic research, competitive analysis, non-public roadmap, architecture trade-offs, security threat detail, private acceptance criteria, implementation ledger, private test corpus, traceability matrix, evaluation evidence, and local Codex prompts.
- Any material labeled `PRIVATE_SPECIFICATION_DO_NOT_COMMIT`, `PRIVATE_OPERATOR_MATERIAL`, or equivalent.

The public OSS repository may contain product code, public API contracts, public-safe tests, developer documentation, a sanitized README, security reporting instructions, and release notes. It must not contain the private artifacts above, their full text, their identifiers where those identifiers reveal private planning, or near-verbatim derivatives. Public documentation describes *how the released software works*. It does not reveal the full internal product thesis, requirement hierarchy, roadmap, private threat model, unreleased capability matrix, or Codex operating instructions.

This privacy boundary overrides all lower-priority instructions in this harness. In particular, Codex must never place private content in:

- a Git commit, branch, tag, stash intended for sharing, GitHub issue, pull request, discussion, wiki, release, package metadata, source comment, test fixture, changelog, Docker image layer, CI artifact, build log, generated OpenAPI description, telemetry field, screenshot, or demo recording;
- a copied prompt, terminal transcript, public-facing implementation report, or external support request;
- a symlink or bind mount inside the public repository.

When there is doubt about whether a detail is public-safe, treat it as private and omit it from the repository. Implement the behavior using a minimal, public-safe abstraction; record the underlying rationale only in the private work log.

### 0.2 Required workspace layout

Use a sibling-directory or otherwise separate layout. The essential property is that `PRIVATE_AI_ROOT` is **not a descendant of** `PUBLIC_REPO_ROOT`, and `PUBLIC_REPO_ROOT` is **not a descendant of** `PRIVATE_AI_ROOT`.

```text
<workspace>/
├── private-ai-control-plane/                    # never initialized as the public OSS repository
│   ├── harness/
│   │   └── CODEX_AI_COMPANION_OSS_IMPLEMENTATION_HARNESS.md
│   ├── requirements/
│   │   ├── aster/docs/00_GLOSSARY.md ... 10_RELEASE_CRITERIA.md
│   │   ├── morrow/docs/...
│   │   ├── tether/docs/...
│   │   ├── veil/docs/...
│   │   ├── drift/docs/...
│   │   ├── relay/docs/...
│   │   └── pulse/docs/...
│   ├── work/
│   │   ├── aster/EXECUTION_LEDGER.md
│   │   ├── aster/TRACEABILITY.md
│   │   ├── aster/PRIVATE_ADRS/
│   │   ├── morrow/...
│   │   └── ...
│   └── evidence/                                # local test logs, redacted reports, private fixtures
└── repos/
    ├── aster/                                   # public GitHub repository
    ├── morrow/
    ├── tether/
    ├── veil/
    ├── drift/
    ├── relay/
    └── pulse/
```

Set these logical variables for every Codex session. Provide absolute paths in the prompt; do not write them into committed files:

```text
PROJECT=<ASTER|MORROW|TETHER|VEIL|DRIFT|RELAY|PULSE>
PUBLIC_REPO_ROOT=<absolute path to the selected public repository>
PRIVATE_AI_ROOT=<absolute path to the local-only private control plane>
PRIVATE_HARNESS=<absolute path to this file>
PRIVATE_REQUIREMENTS_DIR=<absolute path to private requirement documents for PROJECT>
PRIVATE_WORKDIR=<absolute path to private-ai-control-plane/work/<project>>
PRIVATE_EVIDENCE_DIR=<absolute path to private-ai-control-plane/evidence/<project>>
```

Before editing, Codex must verify that the resolved private paths are outside the Git top-level directory. A path that merely appears ignored is not sufficient; private source material must live outside the public repository by default. The `.gitignore` entries described below are a secondary tripwire, not the primary control.

### 0.3 Private work products and public-safe derivatives

The following split is mandatory:

| Artifact | Location | May be committed? | Notes |
|---|---|---:|---|
| This harness | `PRIVATE_HARNESS` | No | Local-only operator control plane |
| Original requirements corpus | `PRIVATE_REQUIREMENTS_DIR` | No | Source of internal product/design truth |
| Execution ledger | `PRIVATE_WORKDIR/EXECUTION_LEDGER.md` | No | Includes internal decisions, commands, risks |
| Traceability matrix | `PRIVATE_WORKDIR/TRACEABILITY.md` | No | Requirement IDs and implementation evidence |
| Private ADR / trade-off analysis | `PRIVATE_WORKDIR/PRIVATE_ADRS/` | No | Keep strategy and sensitive security context local |
| Redacted implementation report | Codex chat or local report | Not automatically | Must avoid private quotations and paths |
| README / SECURITY / CONTRIBUTING | `PUBLIC_REPO_ROOT` | Yes | Must be reviewed as public-safe |
| Public ADR / runbook | `PUBLIC_REPO_ROOT/docs/` | Yes, selectively | Only a redacted operational/technical rationale |
| API contract / schemas | `PUBLIC_REPO_ROOT/openapi/` or contracts package | Yes | Only released behavior; no internal policy corpus |
| Tests / fixtures | `PUBLIC_REPO_ROOT` | Yes, selectively | Synthetic data only; never private prompt or threat corpus |

A public document can be derived from private context only through **distillation**, never copying. Distillation means retaining only the minimum fact necessary for an external developer to install, operate, contribute to, or safely use the released software. It does not mean replacing a few words in a private requirement document.

### 0.4 Session Input Block

Before implementation, fill only this block in the Codex prompt or the private work log. Do not alter the rest of this file to fit a single task.

```yaml
project: ASTER # ASTER | MORROW | TETHER | VEIL | DRIFT | RELAY | PULSE
mode: BOOTSTRAP # BOOTSTRAP | VERTICAL_SLICE | FEATURE | BUGFIX | REVIEW | RELEASE
objective: "Implement the P0 MVP through a runnable, tested vertical slice."
issue_or_requirement_ids: ["FR-AST-001"] # Private identifiers: never copy into public commits/PRs.
allowed_scope: "Repository-local only; no cross-repository changes."
non_goals: []
private_control_plane:
  public_repo_root: "<absolute path; public Git worktree>"
  private_ai_root: "<absolute path; local-only control plane, outside all public worktrees>"
  private_harness: "<absolute path; this file; read-only to Codex during implementation>"
  private_requirements_dir: "<absolute path; local-only requirements; read-only to Codex during implementation>"
  private_workdir: "<absolute path; local-only session ledger and traceability; Codex may write here>"
  private_evidence_dir: "<absolute path; local-only evidence and private fixtures; Codex may write here>"
  private_to_public_transfer: "PROHIBITED"
  private_remote_allowed: false
constraints:
  preserve_public_api: false
  migration_required: false
  offline_or_local_first_priority: true
  production_security_bar: true
  private_material_may_be_read: true
  private_material_may_be_copied_to_repo: false
  git_commit_or_push_allowed: false
runtime:
  node: "Current LTS"
  package_manager: pnpm
  database: PostgreSQL
  container_runtime: Docker Compose
completion_budget: "Finish the highest-value complete slice; do not leave a broad half-implemented framework."
```

### 0.5 Default assumptions when the input block is incomplete

1. Implement the smallest **real**, persistent, authenticated, tested API slice that proves the selected P0 primary flow.
2. Prefer reversible defaults. Record any durable public-API, database, protocol, or dependency decision in an ADR.
3. Do not introduce a UI, billing, user-growth mechanic, real provider credential, or unrelated integration merely to make a demo look complete.
4. Do not block on a non-critical ambiguity. State the assumption, choose the safest reversible design, implement it, and record it. Stop only for a true hard blocker: missing secret required to execute a requested live integration, irreconcilable source-of-truth conflict, or an explicitly prohibited destructive operation.

---


### 0.6 Codex external-read protocol and hard stop

Codex is permitted to **read** `PRIVATE_HARNESS` and `PRIVATE_REQUIREMENTS_DIR`, and to write implementation evidence only under `PRIVATE_WORKDIR` and `PRIVATE_EVIDENCE_DIR`. It may write production code, tests, and deliberately public-safe documentation only inside `PUBLIC_REPO_ROOT`.

Before reading or editing, Codex must establish the resolved filesystem boundary:

1. Resolve all paths to canonical absolute paths. Do not trust a display path, relative path, alias, symlink, shell variable, or Finder shortcut.
2. Determine the public Git top-level with `git -C "$PUBLIC_REPO_ROOT" rev-parse --show-toplevel`.
3. Verify that `PRIVATE_AI_ROOT`, `PRIVATE_HARNESS`, `PRIVATE_REQUIREMENTS_DIR`, `PRIVATE_WORKDIR`, and `PRIVATE_EVIDENCE_DIR` are all outside that Git top-level after symlink resolution.
4. Verify that the public repository is not nested under the private control plane and that the private control plane is not nested under any public repository.
5. Verify that no public repository has a symlink, bind mount, Git submodule, Git worktree, package `file:` reference, generated source path, or CI upload path pointing to private material.
6. Verify that private control-plane material has no GitHub remote. The default is untracked local files or a local-only Git repository with no remotes. A private remote may be used only after an explicit owner decision and must never be a public/hosted GitHub destination.
7. Stop before making any public-repository change if any check is ambiguous or fails. Record the reason in the private work log. Do not solve the issue by copying or relocating private files.

Do not use `cp`, `rsync`, `ln -s`, `git submodule add`, `git worktree add`, a `file:` package dependency, a path alias, or a broad glob to move/attach content from private directories into a public repository. A local tool sandbox that cannot read the private control plane must be configured with explicit **read-only external directory access**; it must not receive access by mounting the control plane beneath the repository.

### 0.7 Independent public repository contract

Each portfolio project is an autonomous public repository and release unit:

| Rule | Required behavior |
|---|---|
| Repository identity | Each project has its own Git history, GitHub repository, package/module name, CI pipeline, semantic-version lifecycle, issue tracker, release notes, and security policy. |
| No mono-repo coupling | Do not create a portfolio-wide workspace, umbrella repository, shared Git history, or shared release train for the seven public projects. |
| No private coupling | No public project may reference `PRIVATE_AI_ROOT`, any private requirement file, a local machine path, a local database dump, or a control-plane script. |
| No sibling-path dependency | Do not use `file:../aster`, `workspace:*`, direct sibling imports, local package linking, submodules, subtrees, or generated code copied from another unpublished portfolio repository. |
| Public interoperability only | Cross-project integration uses public HTTP/OpenAPI/JSON Schema contracts, versioned reference fixtures, and later published packages only after their individual contracts are stable. |
| Independent testability | A clean checkout of any one repository must build, test, lint, and run its P0 demo without any other portfolio repository or private artifact. |
| Dependency direction | A v0.1 repository may define ports/adapters for another project but must not require that project to exist. Integration is optional and capability-gated. |
| Reference integration | A future integration demo, if needed, is a separately named eighth public proof repository; it is not a hidden package manager workspace and must contain no private planning documents. |

A public repository may have a generic `docs/` directory, but it must contain only public-safe installation, operations, API, contribution, and selectively redacted engineering material. The private requirement corpus is never the source tree for a public `docs/` directory.

### 0.8 Artifact classification and declassification protocol

Treat every artifact as one of the following classes before it is created, edited, staged, attached, or released:

| Class | Examples | Allowed location | Publication rule |
|---|---|---|---|
| `PRIVATE_OPERATOR` | Harness, BMA/StRS/SyRS/AD/DD corpus, traceability, private ADRs, market research, internal roadmap, prompts, threat details, evidence | Only `PRIVATE_AI_ROOT` | Never publish or attach to a public GitHub surface. |
| `PRIVATE_EVIDENCE` | Raw test logs, local DB snapshots, conversation samples, model outputs, pre-release security evidence | Only `PRIVATE_EVIDENCE_DIR` | Never publish. Create separate synthetic public fixtures only after review. |
| `PUBLIC_CANDIDATE` | A distilled README section, API description, runbook, ADR summary, test fixture | Temporary local drafting location or named public file | Requires an explicit content review for private-source leakage before staging. |
| `PUBLIC_RELEASE` | Source, tests with synthetic data, license, OpenAPI, README, CHANGELOG, SECURITY, public runbooks | Inside one selected `PUBLIC_REPO_ROOT` | May be committed only after the private-boundary preflight passes. |

**Declassification is a new-authoring step, not a copy/edit step.** When a private requirement motivates public documentation, write the public material from the released behavior and public API contract. Do not start by duplicating a private file and redacting sentences. Do not retain private requirement IDs, internal priority labels, private architecture options, private acceptance wording, market-research claims, private paths, or Codex instructions in the public derivative.

Private artifacts must carry a visible marker in their first 20 lines, such as:

```text
PRIVATE_OPERATOR_MATERIAL
DO_NOT_COMMIT_OR_PUBLISH
```

The marker is a detection aid, not the security boundary. The actual boundary is external location, restricted transfer, deliberate staging, and preflight verification.

---

## 1. Portfolio Mission and Product Thesis

### 1.1 The problem being solved

Most conversational-AI and AI-companion products treat persona, memory, relationship progression, safety controls, orchestration, model routing, and evaluation as opaque product features. The durable OSS opportunity is not to replicate a closed consumer companion application. It is to provide **portable, auditable, self-hostable infrastructure** that lets product teams build trustworthy conversational systems with:

- Local or cloud model choice instead of provider lock-in.
- Explicit, versioned behavior instead of persona hidden in one giant prompt.
- Consent-aware memory and verifiable deletion instead of indefinite transcript accumulation.
- Fail-closed policy decisions rather than prompt-only safeguards.
- Explainable relationship and scenario state rather than undisclosed engagement optimization.
- Reproducible quality and safety regression testing rather than manual “it feels better” evaluation.
- Commercially usable code and a clean separation between repository license, third-party dependency licenses, and each model’s separate license/terms.

### 1.2 Market and strategic context

The prior investigation identified a fragmented landscape:

- Consumer companion products are generally closed and differentiated by relationship continuity, memory, personalization, and polished interaction rather than transparent infrastructure.
- Character and roleplay platforms emphasize community-created characters, discovery, and rapid interaction; their core mechanics are rarely deployable building blocks for product teams.
- Localization matters strongly in companion experiences, but core infrastructure should remain language-neutral and let the selected model or localization layer handle Japanese, Chinese, Hindi, Arabic, French, Spanish, German, and other languages.
- Existing open-source ecosystems already contain capable LLM gateways, tracing tools, prompt tools, vector stores, orchestration frameworks, and agent frameworks. Rebuilding those indiscriminately is weak strategy.

Therefore the portfolio should compete on **explicit contracts, privacy, portability, safety evidence, and composability**, not on claiming to be a universal replacement for every existing AI platform.

### 1.3 Non-negotiable product principles

1. **Model-agnostic by architecture, not marketing.** Every model/provider-specific feature is capability-gated through adapters. Never pretend all providers are equivalent.
2. **Local-first compatible.** The system must work with local or self-hosted inference endpoints without requiring a cloud control plane.
3. **Commercially practical.** Use Apache-2.0 for the repository unless a deliberate exception is approved. Never add GPL/AGPL dependencies to the core path without explicit approval and license review.
4. **Fail closed.** Unknown tenant, missing authorization, invalid configuration, untrusted policy result, failed redaction, and unsafe fallback must deny, stop, or escalate—not silently permit.
5. **Explicit state beats hidden prompt state.** Persona, policy, memory consent, relationship transitions, scenario transitions, and evaluation baselines are modeled as versioned data and auditable decisions.
6. **No dependency or emotional-manipulation optimization.** Do not implement mechanisms intended to maximize emotional dependence, compulsive return, or coercive attachment.
7. **Adult and consent-aware domain posture.** Do not model minors, age ambiguity, coercion, exploitation, or deceptive claims of sentience/real-world exclusivity as product capabilities. The core is a general conversational-AI infrastructure layer, not a sexual-content engine.
8. **Evidence over appearance.** A feature is incomplete until its API contract, persistence behavior, authorization, audit evidence, tests, and failure behavior are demonstrated.

---

## 2. Portfolio Map

| Repository | Core proposition | Strongest differentiator | Primary users | MVP boundary | Do not build in v0.1 |
|---|---|---|---|---|---|
| **ASTER** | Persona Contract Compiler | Versioned, validated, model-independent persona bundles | Companion/NPC/tutor/brand-assistant developers | Persona schema, versions, compile, diff, plugin validation, audit | Chat UI, model inference, safety engine |
| **MORROW** | Consent-Aware Memory Engine | Typed memory with consent, retention, deletion, and audit | AI product, safety, privacy teams | Register/query/revoke/delete/export, embeddings adapter | Full transcript archive, identity verification, medical memory model |
| **TETHER** | Relationship State Engine | Explainable event-driven relationship state with boundaries | Companion/game/education product teams | Model DSL, event transition, snapshot, explanation, decay | Emotion inference, dependency optimization, therapy/diagnosis |
| **VEIL** | Conversational AI Policy Decision Point | Versioned, auditable policy decisions with safe failure | Product safety/security/compliance teams | Policy bundle, decision API, adapters, audit, appeals | Full moderation console, automatic legal certification |
| **DRIFT** | Scenario and Session Orchestrator | Versioned scenario graph and minimal context packs | Interactive story/game/tutor/assistant teams | Graph validation, sessions, event transitions, context pack, replay | Full agent framework, broad workflow SaaS |
| **RELAY** | Local/Cloud LLM Gateway | Policy-aware route control and provider portability | AI backend/SRE/FinOps/on-prem teams | Unified chat/embeddings, route dry-run, usage, provider validation | Training/fine-tuning, general secret-vault replacement |
| **PULSE** | Conversational AI Evaluation Harness | Reproducible quality/safety regression evidence | QA/ML/SRE/release teams | Versioned suites, runs, evaluators, baseline, redaction, regression | “LLM judge only” release decisions, unlimited production-log capture |

### 2.1 Dependency and release strategy

The repositories remain independent OSS projects and independent public GitHub repositories. Do **not** create a seven-package mega-monorepo, a shared workspace, sibling-path dependencies, a private-control-plane submodule, or a portfolio-level release train. Cross-repository interoperability is delivered only through public OpenAPI/JSON Schema contracts, semantic versioning, synthetic reference fixtures, and an optional separately named integration demo after individual APIs stabilize.

Recommended portfolio sequence:

1. **ASTER** — highest clarity of scope; establishes explicit persona contracts.
2. **VEIL** — establishes fail-closed decision semantics before policy becomes scattered across prompts.
3. **MORROW** — establishes consent, retention, deletion, and audit before persistent memory is normalized.
4. **PULSE** — protects the prior components from silent regression and produces credibility evidence.
5. **DRIFT** — composes persona/policy/memory references into controlled session flow.
6. **TETHER** — add only after boundaries, audit, and product semantics are clear; use it for explainable state, never covert emotional scoring.
7. **RELAY** — keep this deliberately thin and differentiating. Build a policy-aware, local/cloud-compatible adapter layer; do not spend early months reproducing the entire gateway ecosystem.

This sequence is a strategic default, not a mandatory technical dependency. A project may use an adapter interface rather than importing another portfolio repository at v0.1.

### 2.2 Commodity-risk rule

Before adding a major capability, Codex must classify it:

- **Differentiating core**: explicit contracts, consent/revocation, policy evidence, explainability, fail-closed state semantics, reproducible evaluation.
- **Necessary commodity**: HTTP server, migrations, authentication adapter, OpenAPI, observability, local provider adapter.
- **Commodity to integrate rather than recreate**: full featured gateway management, tracing dashboards, vector database internals, identity provider, secret vault, analytics warehouse, billing, frontend administration console.

For a commodity capability, prefer a narrow adapter, documented integration point, and conformance test. Build native functionality only where it is necessary to preserve the project’s safety, portability, or audit invariant.

---

## 3. Governing Architecture and Engineering Standards

### 3.1 Baseline stack

Use the following unless a repository already has an approved alternative:

- TypeScript with `strict: true`; `any` is prohibited in production code.
- Node.js current LTS and `pnpm` workspace.
- Fastify or an equivalent typed HTTP framework.
- PostgreSQL as the durable system of record.
- OpenAPI 3.1 and JSON Schema as external contracts. Runtime validation occurs at every trust boundary.
- Docker Compose for local integration environment.
- Vitest for unit tests; Testcontainers or an equivalent real-PostgreSQL integration test strategy.
- ESLint, Prettier, CI workflow, dependency/license/security scan hooks.
- OpenTelemetry-compatible trace propagation; structured JSON logs.

A recommended **public repository** shape. Private planning material is deliberately absent:

```text
<repo>/
├── apps/api/                    # HTTP transport, dependency wiring, middleware
├── packages/core/               # domain entities, use cases, invariants
├── packages/contracts/          # released OpenAPI, JSON Schema, DTOs, fixtures
├── packages/adapters/           # PostgreSQL, auth, provider/plugin, secrets, clock
├── packages/sdk-ts/             # generated or maintained TypeScript SDK
├── packages/testing/            # public-safe shared test helpers and synthetic fixtures
├── docs/
│   ├── adr/                     # only selectively redacted public ADRs
│   └── runbooks/                # public-safe operator/developer runbooks
├── scripts/
│   └── check-private-boundary.mjs
├── tests/                       # end-to-end and cross-package tests
├── .gitignore                   # private-material tripwire patterns
├── .dockerignore
├── .npmignore                   # when a package is published
├── docker-compose.yml
└── pnpm-workspace.yaml
```

Private counterparts such as `AGENTS.private.md`, implementation ledgers, traceability maps, original requirements, and this harness belong only under `PRIVATE_WORKDIR`, `PRIVATE_REQUIREMENTS_DIR`, or `PRIVATE_HARNESS`. Do not create a repository-root `CODEX_IMPLEMENTATION_HARNESS.md` or `AGENTS.private.md` merely for convenience.

### 3.2 Hexagonal dependency rule

```text
transport / CLI / worker
          ↓
application use cases
          ↓
domain model and invariants
          ↑
ports (repositories, policy, provider, clock, idempotency, audit)
          ↑
adapters (PostgreSQL, HTTP provider, auth, queue, secrets)
```

- Domain code must not import Fastify, ORM types, database clients, cloud SDKs, provider SDKs, or `process.env`.
- Application code declares ports and orchestrates transactions.
- Adapters own I/O and third-party semantics.
- Transport validates requests, obtains authenticated context, maps typed errors, and never contains business policy.
- Dependency direction is enforced by lint rules, package boundaries, or architecture tests.

### 3.3 Shared request/response rules

All protected HTTP endpoints use:

```text
Authorization: Bearer <token or service credential>
X-Tenant-Id: <tenant-id>
X-Correlation-Id: <optional client-supplied trace id>
Idempotency-Key: <required for side-effecting endpoint unless explicitly exempt>
```

Important: `X-Tenant-Id` is a requested tenant context, **not** an authorization source. The authenticated principal determines the allowed tenant scope. Mismatch is denied. In development, an explicit development-only auth adapter may be used only when the environment is marked development/test; production startup must fail if no production-safe auth adapter is configured.

Success envelope:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "correlationId": "corr_...",
    "apiVersion": "v1"
  }
}
```

Failure envelope:

```json
{
  "error": {
    "code": "TENANT_SCOPE_DENIED",
    "message": "Request cannot access this resource.",
    "details": [],
    "correlationId": "corr_..."
  }
}
```

Rules:

- Do not expose resource-existence details before authorization.
- Return stable machine-readable error codes.
- Return 422 for schema/domain validation, 401 for unauthenticated, 403 for authenticated-but-not-authorized, 404 only when existence is safe to reveal or indistinguishable by design, 409 for version/idempotency conflicts, and 503 for safe transient dependency failure.
- Every write has an idempotency strategy. A repeated request with the same key must not duplicate state changes, external side effects, charges, or audit events.
- API begins at `/v1`. Breaking changes require a new version or documented deprecation window.

### 3.4 Multi-tenancy, authorization, and data integrity

Every mutable resource includes at minimum:

```text
id, tenant_id, created_at, created_by, updated_at, version
```

Required invariants:

- Every query that reads, writes, updates, deletes, or joins tenant-owned data includes `tenant_id` in the database predicate. Do not fetch globally then filter in memory.
- Use optimistic concurrency (`version`, `updated_at` conditional update, or equivalent) for updateable aggregate roots.
- Use a database transaction for aggregate write + audit event + outbox event when all three must succeed together.
- Audit events are append-only. Corrections create later events; do not mutate historical evidence.
- Soft delete, revocation, expiration, and hard deletion have distinct semantics. Document which applies to each entity.
- Outbox events must be idempotent and safe to replay.

### 3.5 Fail-closed decision matrix

| Condition | Required default behavior |
|---|---|
| Missing/invalid authorization | Reject; do not infer a tenant or role |
| Tenant mismatch or absent tenant scope | Reject; no data lookup beyond safe validation |
| Invalid configuration/schema/plugin capability mismatch | Fail startup or reject the operation |
| Unknown policy result / policy timeout | `BLOCK` or `ESCALATE`; never `ALLOW` |
| External provider timeout before side effect | Return typed retryable failure; do not silently route sensitive data elsewhere |
| Tool action has started | Never auto-replay on a fallback provider unless a proven idempotency contract explicitly permits it |
| Memory consent cannot be proven | Do not persist or retrieve the memory |
| Redaction fails | Do not store raw trace; mark run failed-safe/inconclusive |
| Scenario guard cannot be evaluated | Do not transition |
| Relationship boundary rule conflicts with a positive score | Reject model/rule configuration; do not silently award state |
| Unknown plugin or incompatible plugin | Fail validation/startup; do not ignore it |
| Migration safety is unknown | Stop release; create backup/restore and migration verification evidence |

### 3.6 Privacy and secret handling

- Secrets enter only through a `SecretReference`/secrets port. Do not persist raw API keys in normal application tables, logs, OpenAPI examples, test fixtures, error messages, or exports.
- Use deterministic redaction tests that scan logs/fixtures for representative secret patterns.
- Store hashes, identifiers, reason codes, and data classifications where full text is not needed for audit.
- Retain raw conversational content only when the selected project explicitly requires it; use minimal fields and configurable retention. Default should be conservative.
- Build export and deletion semantics into stateful projects at the beginning, not as a later cleanup task.
- Never use real personal data in seeds or tests.

### 3.7 Plugin and adapter discipline

A plugin/adapter is a deliberately narrow boundary, not an excuse to hide undefined behavior.

```ts
export interface Plugin {
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  healthCheck(context: PluginContext): Promise<PluginHealth>;
  shutdown?(): Promise<void>;
}
```

Rules:

- Plugin input receives explicit tenant context, correlation ID, cancellation/timeout context, and typed request data.
- Host controls timeout, retry policy, circuit breaking, fallback policy, capability validation, and secret references.
- Plugin outputs are validated at the boundary.
- Compatibility is asserted using `coreApiVersion` and contract tests. Incompatibility prevents activation.
- Every initial plugin abstraction must have at least one real implementation and one failure test. Do not ship an empty plugin framework.

### 3.8 Observability and reproducibility

- Generate or propagate `requestId` and `correlationId` on every request.
- Trace all HTTP boundaries, external provider calls, state transitions, policy decisions, plugin calls, and asynchronous jobs.
- Structured logs must include event name, outcome, duration, correlation IDs, tenant pseudonym/ID where appropriate, and safe reason code—not raw sensitive payloads.
- Inject clock, UUID/ID generator where determinism matters, random source, provider client, and retry strategy.
- Make time-based decay, TTL, retries, and scheduled jobs reproducible in tests.

---

## 4. Repository-Specific Contracts

### 4.1 ASTER — Persona Contract Compiler

**Mission**: Convert a validated persona specification into a model-independent compiled context bundle with provenance. ASTER does not infer whether a persona is good, does not store full conversations, and does not implement age/safety classification itself.

**P0 functional requirements**:

| ID | Requirement | Acceptance evidence |
|---|---|---|
| FR-AST-001 | Validate Persona Contracts in JSON/YAML. | Missing required fields, unknown types, and cyclic references return 422. |
| FR-AST-002 | Compile a valid contract into a model-independent bundle. | Same input + compiler version produces same content hash. |
| FR-AST-003 | Create, publish, deprecate, and diff persona versions. | Published versions are immutable; diff returns changed components. |
| FR-AST-004 | Register/validate context injector and renderer plugins. | Unknown plugin reference stops compilation fail-closed. |
| FR-AST-005 | Preserve external policy references in the compiled bundle. | Absence of a reference never disables safety by implication. |
| FR-AST-006 | Audit input version, components, hash, and generation metadata. | Bundle includes source/provenance metadata. |

**P0 endpoints**:

```text
POST /v1/personas
POST /v1/personas/{personaId}/versions
POST /v1/personas/{personaId}/versions/{version}/compile
GET  /v1/personas/{personaId}/versions/{version}/diff/{otherVersion}
POST /v1/plugins/validate
```

**Core domain model**:

```text
Persona -> PersonaVersion (draft | published | deprecated)
PersonaVersion -> PersonaContract + ComponentRefs + PolicyReferences
Compilation -> CompiledBundle(contentHash, compilerVersion, provenance)
PluginManifest -> capabilities + coreApiVersion + enabled state
```

**Critical tests**:

- Deterministic bundle hash under a fixed compiler version and canonical serialization.
- Published contract immutability.
- Unknown/incompatible plugin blocks compile.
- Tenant isolation on every persona/version/bundle query.
- API change writes are idempotent and auditable.

**Avoid**: a prompt editor UI, provider-specific prompt dialect explosion, hidden template mutation after publication, or a “persona score” system.

### 4.2 MORROW — Consent-Aware Memory Engine

**Mission**: Manage typed conversational memory with source, confidence, consent, retention, revocation, deletion, export, and audit. MORROW does not become a default permanent archive of all chats.

**P0 functional requirements**:

| ID | Requirement | Acceptance evidence |
|---|---|---|
| FR-MOR-001 | Register `episodic`, `fact`, `preference`, `relationship`, and `instruction` memories. | Source, confidence, tenant, subject, and retention are mandatory. |
| FR-MOR-002 | Validate consent and retention before write. | Missing consent prevents persistence and returns 403. |
| FR-MOR-003 | Query by tenant, subject, purpose, and policy reference. | Other tenant or deleted memory never appears. |
| FR-MOR-004 | Revoke/delete/expire memory and derivatives. | Original and derived items become inaccessible with documented terminal status. |
| FR-MOR-005 | Support replaceable embedding providers. | Provider outage disables vector search; only explicitly permitted metadata search remains. |
| FR-MOR-006 | Audit create/read/delete/export. | Append-only evidence includes actor, reason, and correlation ID. |

**P0 endpoints**:

```text
POST /v1/memories
POST /v1/memories/query
POST /v1/memories/{memoryId}/revoke
POST /v1/deletion-requests
GET  /v1/subjects/{subjectId}/export
```

**Core domain model**:

```text
Memory(subjectId, type, contentRef/content, source, confidence, classification)
ConsentReceipt(subjectId, purpose, scope, grantedAt, expiresAt, revocable)
RetentionRule(type, purpose, ttl, deletionMode)
DeletionRequest -> DeletionJob -> DeletionEvidence
MemoryDerivative(parentMemoryId, kind, provider/version metadata)
```

**Critical tests**:

- Consent is checked before DB insert and before retrieval.
- Tenant/subject/purpose filtering occurs in persistence query—not after retrieval.
- Revocation/deletion removes both original and derived retrieval paths.
- Embedding failure cannot broaden results or bypass purpose restriction.
- Export is scoped, auditable, and redacted per policy.

**Avoid**: using similarity score as authorization, unbounded transcript ingestion, opaque summaries without provenance, and silently retaining derived embeddings after deletion.

### 4.3 TETHER — Relationship State Engine

**Mission**: Maintain declared relationship state as a reproducible, explainable state machine. It is a general state engine for companion, game, education, customer interaction, and community products—not a psychological diagnosis or engagement manipulator.

**P0 functional requirements**:

| ID | Requirement | Acceptance evidence |
|---|---|---|
| FR-TET-001 | Declare axes, ranges, events, transitions, and decay in a relationship model. | Out-of-range values and undefined events return 422. |
| FR-TET-002 | Apply events atomically and persist snapshots. | Same idempotency key cannot update state twice. |
| FR-TET-003 | Explain each state change. | Explanation contains rule ID, before/after, and evidence event. |
| FR-TET-004 | Treat boundary violations as warning/policy reference, not positive state progression. | Invalid positive boundary rule is rejected at model validation. |
| FR-TET-005 | Run deterministic time-based decay. | Same baseline time yields identical recomputation. |
| FR-TET-006 | Manage model/snapshot compatibility. | Old snapshots cannot be used under a new model until migration completes. |

**P0 endpoints**:

```text
POST /v1/relationship-models
POST /v1/relationships
POST /v1/relationships/{relationshipId}/events
GET  /v1/relationships/{relationshipId}/explanation
POST /v1/relationships/{relationshipId}/decay-preview
```

**Core domain model**:

```text
RelationshipModelVersion -> axes + eventDefinitions + transitionRules + boundaryRules + decayRules
Relationship -> Snapshot(versioned state)
RelationshipEvent -> AppliedTransition / RejectedTransition
Explanation -> ruleId + inputs hash + before + after + reasonCode
```

**Critical tests**:

- Rule validation rejects contradictory boundaries and non-deterministic declarations.
- Replay of an event stream gives the same snapshot.
- Decay is deterministic with injected clock.
- Idempotency and optimistic locking prevent duplicate/reordered updates.
- Explanation never leaks unrelated raw user content.

**Avoid**: hidden emotional scoring, “attachment maximization,” claims about genuine feelings, manipulative nudging, or LLM-generated state mutations without explicit validated event mapping.

### 4.4 VEIL — Conversational AI Policy Decision Point

**Mission**: Return an explicit, auditable policy decision for conversational AI. VEIL must not provide a false sense of safety; it is a configurable decision component with evidence and safe failure semantics.

**P0 functional requirements**:

| ID | Requirement | Acceptance evidence |
|---|---|---|
| FR-VEI-001 | Register, validate, sign/verify as applicable, and publish immutable policy versions. | Invalid policy cannot be published. |
| FR-VEI-002 | Return `ALLOW`, `TRANSFORM`, `REQUIRE_CONFIRMATION`, `BLOCK`, or `ESCALATE`. | Unknown/timeout never returns `ALLOW`. |
| FR-VEI-003 | Include age-assurance claim, boundary declaration, and tenant settings in decisions. | Unmet age condition returns explicit safe result. |
| FR-VEI-004 | Compose classifier/rule/human-review adapters. | Adapter timeout/confidence/fallback is configured and tested. |
| FR-VEI-005 | Audit decision evidence. | Input hash, rule ID, policy version, and correlation ID stored. |
| FR-VEI-006 | Accept appeals tied to prior decisions. | Appeal cannot exist without a decision ID. |

**P0 endpoints**:

```text
POST /v1/policy-bundles
POST /v1/policy-bundles/{policyId}/versions/{version}/validate
POST /v1/decisions
POST /v1/appeals
GET  /v1/decisions/{decisionId}
```

**Core domain model**:

```text
PolicyBundle -> PolicyVersion (draft | published | deprecated)
DecisionRequest -> Decision(action, reasonCodes, obligations, evidenceHash)
PolicyAdapterResult -> confidence + result + sourceVersion + latency
Appeal -> decisionId + reviewer outcome + evidence
```

**Critical tests**:

- Timeout, unsupported adapter, malformed policy, absent age claim, and ambiguous rule all fail safe.
- Policy publication is immutable and reproducible.
- Policy evidence uses hashes/minimal metadata, not unnecessary raw content.
- Appeal relationship integrity and authorization are enforced.
- Decision integration test confirms external actions are not started before an `ALLOW`/allowed transformed result.

**Avoid**: a giant untestable natural-language policy prompt, implicit “safe by default,” a claim of legal compliance certification, or a bypass through unavailable classifier.

### 4.5 DRIFT — Scenario and Session Orchestrator

**Mission**: Execute declared scenario graphs and sessions while producing minimal, explicit context packs. DRIFT is not a general agent framework and should not bury workflow state inside model prompts.

**P0 functional requirements**:

| ID | Requirement | Acceptance evidence |
|---|---|---|
| FR-DRI-001 | Define scenario graphs from scenes and transitions. | Detect unreachable scenes, duplicate IDs, and non-terminating-only paths. |
| FR-DRI-002 | Persist session state, slots, history references, and fixed scenario version. | Existing sessions are unaffected by later scenario publication. |
| FR-DRI-003 | Execute only permitted transitions after guard evaluation. | Failed guard leaves state unchanged and returns reason code. |
| FR-DRI-004 | Produce minimal context packs. | Includes required slots/policy references, not entire history by default. |
| FR-DRI-005 | Run action plugins asynchronously with safe stop/compensation state. | Action failure reaches defined safe status. |
| FR-DRI-006 | Persist replayable event log. | Same scenario version + event stream reproduces end state. |

**P0 endpoints**:

```text
POST /v1/scenarios
POST /v1/scenarios/{scenarioId}/versions/{version}/validate
POST /v1/sessions
POST /v1/sessions/{sessionId}/events
GET  /v1/sessions/{sessionId}/context-pack
```

**Core domain model**:

```text
ScenarioVersion -> Scene[] + Transition[] + Guard[] + ContextRules
Session -> scenarioVersion + currentScene + slots + status
SessionEvent -> transition decision + event sequence
ContextPack -> explicit instructions/references/slots + provenance
ActionExecution -> pending | completed | failed | compensated | stopped_safe
```

**Critical tests**:

- Static graph validation and deterministic transition replay.
- Session version pinning.
- Guard failure cannot mutate state.
- Context pack minimization and no full-history default.
- External action error invokes compensation or safe stop, never silent continuation.

**Avoid**: arbitrary code execution in scenario definitions, unrestricted tool action retries, an all-purpose agent planner, or embedding sensitive memory wholesale into prompts.

### 4.6 RELAY — Local/Cloud LLM Gateway

**Mission**: Provide a narrow, policy-aware, model/provider abstraction layer for local and cloud inference. RELAY must remain a differentiating integration boundary, not a redundant recreation of a full gateway ecosystem.

**P0 functional requirements**:

| ID | Requirement | Acceptance evidence |
|---|---|---|
| FR-REL-001 | Call adapters through unified chat/stream/embedding/tool contracts. | Required fields and capability errors are explicit. |
| FR-REL-002 | Route by tenant, purpose, data classification, and cost cap. | Noncompliant route is rejected before external send. |
| FR-REL-003 | Handle stream interruption with audited partial output/end reason. | Client receives partial state and typed termination. |
| FR-REL-004 | Make fallback idempotent and prevent duplicate charges/tool calls. | Tool-started requests do not auto-fallback without proven safe idempotency. |
| FR-REL-005 | Resolve secrets through references only. | Secret-pattern test fails on log/export exposure. |
| FR-REL-006 | Record token/latency/route/provider/cost estimate/trace metadata. | Raw PII text is excluded by default. |

**P0 endpoints**:

```text
POST /v1/chat/completions
POST /v1/embeddings
GET  /v1/routes/resolve
GET  /v1/usage
POST /v1/providers/validate
```

**Provider strategy**:

- Start with one **OpenAI-compatible HTTP adapter** configurable for local/self-hosted and compatible remote endpoints. This covers a broad class of local inference servers without embedding vendor SDKs in the core.
- Add a second cloud/inference adapter only when a primary-source API contract and license/terms are verified.
- Represent capabilities explicitly: `chat`, `stream`, `embeddings`, `tools`, `json_mode`, `vision`, `reasoning_metadata`, etc. A route may require capabilities and must reject a provider that cannot satisfy them.
- “Hugging Face support” means an adapter/configuration path to an approved inference endpoint or self-hosted runtime; it does **not** mean the repository guarantees every model’s commercial rights. Model license/terms remain an operator responsibility and should be represented as route metadata/policy input where useful.

**Core domain model**:

```text
ProviderConfig -> providerId + adapterType + capabilities + secretReference + status
ModelRoute -> tenant/purpose/dataClassification/cost/capability constraints + ordered candidates
InferenceRequest -> normalized messages + tools + dataClassification + idempotency context
InferenceAttempt -> route/provider/model + outcome + token/cost metadata + trace
ToolExecutionFence -> not_started | started | completed, used to control fallback
```

**Critical tests**:

- Route denial happens before outbound HTTP call.
- Streaming abort records correct terminal reason.
- Tool fence prevents unsafe fallback.
- Cloud/local capability mismatch fails explicitly.
- Secret redaction holds across configuration validation, logs, errors, and usage records.

**Avoid**: implementing model training, scraping provider behavior, silently downgrading sensitive data to an external route, storing raw provider API keys, or promising feature parity across models.

### 4.7 PULSE — Conversational AI Evaluation Harness

**Mission**: Maintain versioned evaluation suites and produce reproducible evidence for quality, safety, latency, cost, and regression. PULSE does not make a single probabilistic LLM judge the sole release authority.

**P0 functional requirements**:

| ID | Requirement | Acceptance evidence |
|---|---|---|
| FR-PUL-001 | Register versioned suites with inputs, expected conditions, tags, classification, and evaluators. | Published suite is immutable. |
| FR-PUL-002 | Start runs via HTTP/CLI/SDK and persist case results/traces. | Run records suite version, target config, and correlation ID. |
| FR-PUL-003 | Execute rule/schema/semantic/external-judge evaluators through plugins. | External judge failure is `inconclusive`, never `pass`. |
| FR-PUL-004 | Compare against baselines. | Threshold breach returns non-zero CI exit code. |
| FR-PUL-005 | Redact trace before persistence. | Redaction failure stores no raw trace and fails safe. |
| FR-PUL-006 | Aggregate quality/refusal/latency/cost/inconclusive rate. | Filters work by suite version/model/time/tenant. |

**P0 endpoints**:

```text
POST /v1/suites
POST /v1/runs
GET  /v1/runs/{runId}
GET  /v1/regressions
POST /v1/baselines
```

**Core domain model**:

```text
EvalSuiteVersion -> Case[] + EvaluatorRefs + thresholds + dataClassification
EvalRun -> target config + suite version + status + correlation ID
CaseResult -> pass | fail | inconclusive | error + evidence
Trace -> redacted request/response metadata + timings + provider metadata
Baseline -> accepted metrics/conditions + scope + version
Regression -> baseline delta + severity + CI outcome
```

**Critical tests**:

- Suite immutability and baseline comparison.
- Deterministic rule/schema evaluator behavior.
- External judge timeout/error becomes inconclusive.
- Redaction failure prevents raw trace storage.
- CI command returns non-zero for material regression.

**Avoid**: automatically collecting all production conversations, storing raw sensitive text by default, hiding inconclusive results, or declaring “safe” solely because a model judge approved an output.

---

## 5. Canonical P0 Delivery Shape

A P0 release is not “a folder structure and some stubs.” It must expose one working vertical slice with real persistence and evidence.

### 5.1 Minimum deliverables for every repository

- `README.md`: public-safe purpose, non-goals, architecture sketch, quick start, released API example, local run, test commands, data/security notes, license notice, and known limitations. It must not reproduce private requirements, strategy, requirement IDs, or Codex instructions.
- `PRIVATE_WORKDIR/AGENTS.private.md`: concise repository-specific execution rules derived from this harness. Local-only.
- `PRIVATE_WORKDIR/EXECUTION_LEDGER.md`: requirements, files changed, commands run, results, assumptions, residual risks. Local-only.
- `PRIVATE_WORKDIR/TRACEABILITY.md`: `private requirement -> public-safe design statement -> code path -> test IDs` mapping. Local-only.
- `PRIVATE_WORKDIR/PRIVATE_ADRS/`: internal alternatives, strategy, and sensitive security rationale. Local-only.
- Selective `docs/adr/ADR-001-architecture.md`: only a deliberately redacted public ADR when external contributors need the decision rationale. Omit it entirely until it can be made public-safe.
- OpenAPI 3.1 file, JSON Schemas, and examples generated/checked from one source of truth where practical. They describe released behavior only.
- TypeScript SDK or an intentionally narrow typed client package for the P0 public endpoints.
- PostgreSQL migration(s), synthetic fixture strategy, and integration tests against real PostgreSQL.
- Auth context port and safe dev/test adapter; production configuration validation.
- Tenant isolation test, authorization test, idempotency test, audit test, and fail-closed dependency test.
- Docker Compose quick start and health/readiness endpoints, with `.dockerignore` excluding all private material and local data.
- CI jobs for format/lint/typecheck/unit/integration/contract/security scan plus private-boundary scan (where tooling permits).
- Public artifact checks: `npm pack --dry-run` where relevant, Docker build-context review, and release-asset allowlist.

### 5.2 P0 exit criteria

A P0 primary flow is accepted only when all of the following are true:

1. A user can run `docker compose up` (or documented equivalent) and execute the primary flow against PostgreSQL.
2. The endpoint validates input, authenticates, checks tenant/role scope, persists state transactionally, writes audit evidence, and returns a documented response.
3. Repeating the same write with the same idempotency key cannot duplicate durable or external effects.
4. Invalid/missing config, authorization, policy/consent guard, or adapter failure produces safe failure, with test evidence.
5. OpenAPI, request schema, response schema, errors, SDK, and contract tests agree.
6. Source code passes formatting, linting, typecheck, unit, integration, and contract tests.
7. The public README states only public-safe operating facts, while the private execution ledger states exactly what works, what is deliberately omitted, and what remains risky.

---

## 6. Codex Operating Protocol

### 6.1 Hierarchy of authority

When instructions conflict, obey this order:

1. Explicit current user instruction.
2. The non-public artifact boundary in Section 0: never publish or commit private operator material.
3. Security, privacy, fail-closed, and non-goal constraints in this harness.
4. Repository-specific requirements in Section 4 and the local private requirement corpus.
5. Executable behavior: current tests, contracts, migrations, and production code—after checking whether they conflict with the intended requirement.
6. Existing code style and conventions.
7. A safe, reversible engineering judgment documented in a private ADR or execution ledger.

A public README, existing code comment, issue, or previous commit does not authorize copying private material into the repository. Privacy uncertainty is resolved by omitting the detail from public artifacts and retaining the rationale only in the private work log.

Codex must never silently resolve a conflict by changing a requirement or deleting a failing test. It must explain the conflict, identify the governing source, and make the smallest compliant change.

### 6.2 Work loop: inspect → plan → implement → prove → document

For every meaningful task, Codex executes the following loop in the same session as far as practical:

1. **Inspect and establish the privacy boundary**
   - Read `PRIVATE_HARNESS`, `PRIVATE_WORKDIR/AGENTS.private.md` when present, the local private requirement corpus, `README.md`, package scripts, CI config, current tests, and relevant code. Treat all private artifacts as read-only session context unless the current task explicitly asks to update the private work log.
   - Resolve `PUBLIC_REPO_ROOT`, `PRIVATE_HARNESS`, `PRIVATE_REQUIREMENTS_DIR`, `PRIVATE_WORKDIR`, and `PRIVATE_EVIDENCE_DIR`. Verify that every private path is outside the Git top-level directory. Do not use symlinks into the public repository.
   - Run a read-only repository inventory: project structure, package manager, Git status, tracked-file list, ignored-file rules, current test baseline, generated files, migration state, and unresolved TODOs relevant to the selected scope.
   - Run the private-boundary preflight before coding. It must confirm that the harness, requirement file names, private work directory, private markers, raw production data, and private fixtures are not tracked and are excluded from Docker/npm/release artifacts.
   - Do not edit generated files before locating their generator/source.

2. **Plan**
   - Write a brief implementation plan to `PRIVATE_WORKDIR/EXECUTION_LEDGER.md` or update it. Include selected requirement IDs, files likely to change, invariants, test plan, migration/API impact, and explicit non-goals.
   - Identify the smallest end-to-end slice. Prefer one complete P0 behavior over many disconnected abstractions.
   - When the task changes public API, schema, migration, or a durable abstraction, write/update an ADR before implementation.

3. **Implement contract-first**
   - Define/adjust JSON Schema, OpenAPI, domain types, error codes, and test fixtures first.
   - Add a failing unit/contract/integration test that captures the required behavior or regression.
   - Implement domain invariant, application use case, persistence adapter, transport, audit/outbox behavior, and documentation in that order.
   - Keep diffs narrow. Do not refactor unrelated code in the same change.

4. **Prove**
   - Run targeted tests while working, then the repository quality gate.
   - Add adversarial tests: unauthorized, wrong tenant, malformed input, stale version, duplicate idempotency key, dependency timeout, and secret/PII leakage where applicable.
   - For migration work, test a fresh database and an upgrade path from the previous schema. Document rollback/recovery semantics.

5. **Document and report**
   - Update public-safe README/API material only when an external user needs it. Update the private traceability/ledger/ADR/known-limitations record for internal rationale and requirement mapping.
   - Before writing any public documentation or final chat report, perform a private-to-public distillation check: remove copied phrasing, requirement IDs, internal roadmap, private paths, private prompts, and sensitive rationale.
   - Report only claims supported by command output and tests. Clearly label unexecuted checks and external assumptions.

### 6.3 Implementation behavior rules

Codex must:

- Work autonomously within approved scope; select safe reversible defaults rather than repeatedly asking for routine choices.
- Treat every string crossing an HTTP, plugin, environment, queue, file, or database boundary as untrusted until validated.
- Keep mocks at external boundaries. Unit tests should prove domain behavior; integration tests should prove transactions and data isolation; contract tests should prove API compatibility.
- Use typed errors and stable reason codes. Do not communicate expected control flow through string matching.
- Preserve backward compatibility unless the selected task explicitly permits a break.
- Explain uncertainty rather than inventing API, licensing, performance, or security facts.
- Search primary documentation only when external verification is materially required (provider API, protocol behavior, dependency/license compatibility). Record URL/title/version/date or a concise verification note in the ledger where repository policy permits.

Codex must not:

- Copy or paraphrase private harness text, requirement documents, private acceptance criteria, private research, internal requirement IDs, private prompts, or local work-log content into repository files, commits, public issues/PRs, release notes, test fixture names, API descriptions, or user-facing reports.
- Move, symlink, mount, or generate a private artifact beneath `PUBLIC_REPO_ROOT`.
- Replace a failing test with a weaker assertion to make CI green.
- Mark tests as skipped without a tracked reason and expiration criterion.
- Use `any`, silent catch blocks, `TODO` as a substitute for a safety-critical implementation, or `console.log` containing sensitive values.
- Add unverified third-party packages casually; inspect license, maintenance, API surface, and the existing dependency graph first.
- Make an external live network call in tests unless explicitly opt-in and isolated. Default integration tests must be deterministic.
- Declare a feature complete when only types, routes, mocks, or in-memory state exist.
- Build a management UI before core P0 invariants are protected.

### 6.4 Definition of done for each change

A change is done only when it has:

- Requirement/issue ID(s) in code change notes or execution ledger.
- Acceptance test(s) covering success and safe failure.
- API contract change and SDK/docs update when externally visible.
- Tenant/auth/audit/idempotency impact assessed explicitly.
- Migration behavior assessed if persistence changes.
- Command results for `format`, `lint`, `typecheck`, test suites, and build as applicable.
- Known limitations recorded without spin.

---

## 7. Quality Gates and Test Design

### 7.1 Required test layers

| Layer | Proves | Examples |
|---|---|---|
| Unit | Domain invariants and deterministic transformations | policy decision defaults, canonical hash, transition rule, retention calculation |
| Integration | Database transactions, migrations, outbox, repository filtering | tenant predicate, optimistic lock, audit append, deletion propagation |
| Contract | OpenAPI/JSON Schema/SDK/plugin compatibility | request/response fixtures, error envelope, SPI version mismatch |
| Security | Authorization, tenant isolation, secret/PII protection, fail-closed behavior | foreign-tenant ID, missing scope, adapter timeout, redaction failure |
| E2E | Dockerized primary user flow | create → publish → use/query/decision → audit evidence |
| Performance/reliability | Release confidence, not speculative microbenchmarks | p95 target, concurrent update, provider timeout, replay/idempotency |

### 7.2 Test naming and traceability

Use stable test IDs in descriptions or metadata, for example:

```text
TEST-TENANT-001  foreign tenant cannot read resource
TEST-IDEMP-001   same idempotency key creates one durable aggregate
TEST-AUDIT-001   write creates append-only audit evidence
TEST-FAILCLOSED-001 policy timeout does not produce ALLOW
TEST-SECRET-001  secret pattern cannot appear in logs or fixtures
AT-AST-001       valid persona contract compiles to deterministic bundle
```

Maintain:

```text
Mission/Need -> Stakeholder requirement -> FR/NFR -> ADR/design -> code module -> test ID -> command result
```

### 7.3 Mandatory adversarial matrix

Every selected primary flow must include the relevant cases:

| Scenario | Expected result |
|---|---|
| No authorization | 401, no durable state |
| Authenticated but wrong tenant | 403/indistinguishable safe response, no data exposure |
| Required tenant header mismatches token scope | 403, no lookup leaked |
| Malformed JSON/schema | 422, no partial write |
| Unknown enum/capability/plugin | 422 or safe startup failure |
| Repeated idempotency key | Original result or explicit consistent conflict; no duplicate effect |
| Concurrent stale version update | 409, no lost update |
| Database transaction failure | No partially persisted aggregate/audit/outbox combination |
| External adapter timeout | Typed safe failure; no silent bypass/fallback |
| Redaction/consent/policy check cannot complete | No raw persistence/no unsafe execution |
| Service restart | State, idempotency, audit, and migration invariants still hold |

### 7.4 Release gate

Before tagging `v0.1.0`, all must be true:

- Full P0 backlog done and traceable.
- Fresh install and Docker Compose E2E succeed.
- Upgrade/migration plan validated or explicitly deferred with a conservative release scope.
- Tenant bypass, authorization bypass, fail-open policy/consent/config path, and secret leakage have regression tests.
- OpenAPI/SDK/JSON Schema contract checks pass.
- License inventory and vulnerability scan completed with documented review of material findings.
- README includes quick start, limitations, security policy, contributing guide, code of conduct, and Apache-2.0 text—not merely an intention to use Apache-2.0.
- No “known critical defect” remains in tenant isolation, auditability, data deletion, state integrity, or safe failure paths.

---

## 8. Architecture Decisions to Prefer

### 8.1 Versioned immutable artifacts

Use immutable published versions for persona contracts, policy bundles, scenario graphs, relationship models, and evaluation suites. Drafts may mutate; publication produces a new immutable version. Reference execution by version, never “whatever is latest.”

Benefits:

- Reproducible output and investigation.
- Safe rollout/rollback.
- Meaningful audit evidence.
- Stable evaluation baselines.

### 8.2 Canonicalization and hashing

When reproducibility matters, define canonical JSON serialization and hash the canonical representation plus versioned compiler/rule metadata. Never rely on raw object-property ordering or incidental serialization behavior.

Hash inputs should include only the necessary content and versions. Do not hash or persist raw secrets.

### 8.3 Audit and outbox

For any state-changing operation:

```text
validate -> authorize -> load aggregate with tenant filter -> apply invariant -> persist aggregate
        -> append audit event -> append outbox event -> commit transaction
```

Outbox consumers are at-least-once by design; consumers must be idempotent. Audit is evidence, not an event queue substitute.

### 8.4 Safe adapter fallback

A fallback decision must consider:

```text
policyAllowsFallback
AND dataClassificationAllowsTarget
AND requiredCapabilitiesPresent
AND sideEffectFence == not_started
AND idempotencyGuarantee == proven
```

Otherwise return a typed error or escalate. “Provider A timed out, so send the same content to Provider B” is not a safe default.

### 8.5 Configuration validation at startup

Validate all static configuration at startup:

- required auth adapter and production settings,
- database connection/migration compatibility,
- enabled plugin compatibility/capabilities,
- provider route definitions,
- policy/consent rule references,
- required secrets available as references.

A bad deployment should fail early and visibly, not launch in a partially permissive mode.

### 8.6 Error taxonomy

Maintain a typed domain/application error taxonomy, such as:

```text
AUTHENTICATION_REQUIRED
TENANT_SCOPE_DENIED
RESOURCE_NOT_FOUND
VALIDATION_FAILED
VERSION_CONFLICT
IDEMPOTENCY_CONFLICT
CONFIGURATION_INVALID
PLUGIN_INCOMPATIBLE
DEPENDENCY_UNAVAILABLE
POLICY_BLOCKED
POLICY_ESCALATED
CONSENT_REQUIRED
RETENTION_EXPIRED
REDACTION_FAILED_SAFE
MIGRATION_REQUIRED
```

Map them centrally to HTTP status, public message, safe details, and retryability. Do not leak stack traces or provider internals.

---

## 9. Anti-Patterns and Explicit Rejections

Reject or redesign the following immediately:

1. **Prompt-only safety**: Safety needs a testable decision boundary, not only prose appended to a system prompt.
2. **Post-filter authorization**: Querying globally and filtering results after retrieval is a tenant isolation failure.
3. **Implicit latest version**: Session/run/compilation behavior must be pinned to explicit artifact versions.
4. **In-memory “MVP” persistence**: A stateful OSS infrastructure product requires real database behavior and migrations in P0.
5. **Automatic provider fallback after tool start**: This risks duplicate side effects and must be prohibited by default.
6. **LLM judge as sole quality gate**: Use rule/schema/deterministic tests first; label model-judge results probabilistic/inconclusive.
7. **Raw transcript hoarding**: Capture only what is needed, minimize retention, and make deletion propagation testable.
8. **Hidden relationship scoring**: State must be declared, explainable, and bounded; no covert dependency optimization.
9. **Unbounded plugin power**: Plugins require explicit capabilities, version compatibility, timeout, validation, and host-controlled secrets.
10. **Mega-repository premature integration**: Build independent contracts first; make integration a later proof project.
11. **Overbuilding admin UI**: Do not divert P0 from core persistence, policy, audit, contracts, and test evidence.
12. **License handwaving**: Repository code license, dependency licenses, provider terms, and model licenses are separate; verify each before release.
13. **False “production-ready” claim**: Use a release checklist and known limitations. Do not overstate validation.

---

## 10. Codex Prompt Templates

### 10.1 Master implementation prompt

Copy, fill the Session Input Block values, and send this to Codex:

```text
Read `<PRIVATE_HARNESS>` in full and treat it as the governing implementation contract. It is local-only operator material: do not copy, quote, commit, or publish it.

Selected session:
- PROJECT: <ASTER|MORROW|TETHER|VEIL|DRIFT|RELAY|PULSE>
- MODE: <BOOTSTRAP|VERTICAL_SLICE|FEATURE|BUGFIX|REVIEW|RELEASE>
- OBJECTIVE: <one concrete outcome>
- REQUIREMENT/ISSUE IDs: <IDs>
- ALLOWED SCOPE: <paths and constraints>
- NON-GOALS: <items>

Act as the repository’s principal engineer and verification owner, not as a code suggestion generator.

Execution protocol:
0. Resolve `PUBLIC_REPO_ROOT` and every private path. Prove that all private paths are outside the public Git top-level, that no symlink/submodule/path dependency bridges the boundary, and that the selected repository is independent of the other six. If this cannot be proved, stop before editing the public repository.
1. Inspect repository state, public governing files, scripts, tests, CI, and relevant code before editing. Read private material only from the external local paths.
2. State selected private requirements, invariants, likely files, test strategy, migration/API impact, and assumptions only in `PRIVATE_WORKDIR/EXECUTION_LEDGER.md`. Do not copy private requirement text, IDs, private paths, or private rationale into public repository files, public reports, commits, PRs, issues, or chat output.
3. Implement the smallest complete vertical slice. Work contract-first and add failing tests before or alongside implementation.
4. Preserve strict tenant isolation, authorization, idempotency, append-only audit, typed errors, config validation, and fail-closed behavior.
5. Do not add UI, billing, broad integrations, unrelated refactors, a local sibling-package dependency, a Git submodule, or a portfolio-wide workspace.
6. Run the strongest practical quality gate. Do not claim a command passed unless you ran it.
7. Update public-safe README/OpenAPI/JSON Schema only as needed; write private traceability, ADRs, and known limitations only in `PRIVATE_WORKDIR`. Distill rather than copy from private sources.
8. Before any staging, run the private-boundary preflight. Stage only explicitly named public-safe files, never `git add .` or `git add -A`.

Do not stop for routine design choices: choose the safest reversible option and document it. Stop only for a true hard blocker, a destructive operation, or an irreconcilable source-of-truth conflict.

Finish with a concise implementation report containing:
- completed requirements and acceptance evidence;
- files changed;
- commands run and results;
- tests added and failure modes covered;
- migration/API compatibility impact;
- known limitations, assumptions, and remaining risks;
- exact next highest-value task.
```

### 10.2 Bootstrap prompt

```text
Read `<PRIVATE_HARNESS>`. Execute PROJECT=<PROJECT>, MODE=BOOTSTRAP. The harness and requirements are private; do not copy, quote, commit, or publish them.

Create a lean but real v0.1 foundation for this repository. Do not create a mock-only scaffold.

Required outcomes:
- pnpm TypeScript strict workspace with domain/application/adapters/transport separation;
- PostgreSQL Docker Compose environment and migration toolchain;
- OpenAPI 3.1 + JSON Schema contracts for the project P0 endpoints;
- safe auth context port plus development/test-only adapter and production config validation;
- tenant guard, correlation/idempotency middleware, typed error mapper, health/readiness;
- append-only audit and outbox tables/interfaces;
- one complete project-specific P0 primary flow persisted in PostgreSQL;
- unit, integration, contract, tenant-isolation, idempotency, audit, and fail-closed tests;
- public-safe README, selectively redacted public ADR only when needed, CI, and the public-safe private-boundary guard in the repository;
- private execution ledger, private traceability file, and private `AGENTS.private.md` created only under `PRIVATE_WORKDIR`, never under the repository root.

Use one real adapter implementation for every abstraction introduced. Keep all non-P0 features explicitly out of scope. Prove the primary flow with a Dockerized E2E test.
```

### 10.3 Vertical-slice prompt

```text
Read `<PRIVATE_HARNESS>`. Execute PROJECT=<PROJECT>, MODE=VERTICAL_SLICE. The harness and requirements are private; do not copy, quote, commit, or publish them.

Implement exactly this requirement slice: <FR/NFR/Issue IDs and acceptance condition>.

Start by locating the authoritative requirement and existing contract. Then implement, in a narrow coherent diff:
1. contract/schema and stable error behavior;
2. domain invariant and typed use case;
3. persistence/transaction/audit/outbox behavior;
4. transport/SDK integration;
5. success, authorization, tenant, invalid-input, duplicate-idempotency, concurrent/stale-version, and dependency-failure tests as relevant;
6. public-safe docs update only when a released API/operation changes; update traceability and the implementation ledger only under `PRIVATE_WORKDIR`.

Do not broaden the feature. Do not change unrelated public API. If a prerequisite is missing, implement the smallest prerequisite necessary and record it.
```

### 10.4 Bugfix prompt

```text
Read `<PRIVATE_HARNESS>`. Execute PROJECT=<PROJECT>, MODE=BUGFIX. The harness and requirements are private; do not copy, quote, commit, or publish them.

Bug report: <reproduction, observed behavior, expected behavior>

Treat this as a safety and regression task:
- reproduce it with a failing automated test before modifying behavior;
- identify the violated requirement/invariant and the closest failure boundary;
- inspect for adjacent variants: tenant, auth, idempotency, transaction, async retry/fallback, migration, secret/PII leakage;
- implement the smallest root-cause fix, not a symptom workaround;
- add regression tests for the primary and adjacent unsafe paths;
- run the full relevant quality gate and document compatibility impact.

Never hide the defect by swallowing an error, weakening a test, or adding a permissive fallback.
```

### 10.5 Architecture/review prompt

```text
Read `<PRIVATE_HARNESS>`. Execute PROJECT=<PROJECT>, MODE=REVIEW. The harness and requirements are private; do not copy, quote, commit, or publish them.

Perform a hostile-but-constructive implementation review. Do not change code until the evidence-based review is complete.

Review priorities, in order:
1. tenant isolation and authorization;
2. fail-open policy/consent/configuration paths;
3. idempotency, transactions, optimistic locking, outbox/audit integrity;
4. secrets/PII/raw-trace leakage;
5. public API and schema compatibility;
6. provider/plugin capability and fallback safety;
7. test quality, false confidence, and untested failure paths;
8. maintainability, architecture boundaries, documentation drift, and license risk.

For each finding provide severity, affected requirement, proof path/file/line, exploit or failure scenario, minimal remediation, and test required. Then create or update a prioritized remediation plan. Do not invent findings without code evidence.
```

### 10.6 Release prompt

```text
Read `<PRIVATE_HARNESS>`. Execute PROJECT=<PROJECT>, MODE=RELEASE. The harness and requirements are private; do not copy, quote, commit, or publish them.

Assess readiness for v0.1.0 with an evidence-only release review.

Verify:
- P0 requirements and traceability;
- clean checkout bootstrap and Docker Compose E2E;
- API/schema/SDK contracts;
- migrations on fresh and upgrade path;
- tenant/auth/fail-closed/secret-redaction regression suite;
- license notices and dependency inventory;
- README quick start, limitations, security policy, contribution and code of conduct;
- versioning/changelog/release notes;
- independent-repository rule: no private paths, sibling `file:`/workspace dependencies, submodules, or hidden cross-repository runtime requirement;
- publication firewall: private-boundary guard, tracked/staged-file scan, package dry-run, Docker build-context review, and CI artifact/log review.

Output one of exactly:
- GO: all release gates have evidence;
- NO-GO: blockers with severity, proof, remediation, and retest command;
- CONDITIONAL GO: only for explicitly accepted non-critical limitations, clearly listed.

Do not tag or publish unless GO has been established or explicit user approval overrides a listed NO-GO item.
```

---

## 11. Project-Selection Prompts and Initial Backlog

### ASTER first slice

```text
PROJECT=ASTER
MODE=BOOTSTRAP
OBJECTIVE=Create and compile a versioned Persona Contract into a deterministic CompiledBundle.
REQUIREMENT/ISSUE IDs=FR-AST-001, FR-AST-002, FR-AST-003, FR-AST-006
NON-GOALS=UI, LLM inference, dynamic prompt editing, real plugin marketplace
```

Acceptance demonstration:

```text
1. Create persona draft.
2. Create a valid version with JSON/YAML contract.
3. Publish it.
4. Compile it twice under the same compiler version.
5. Observe identical content hash and provenance.
6. Attempt mutate published version -> safe rejection.
7. Attempt compile under wrong tenant/unknown plugin -> safe rejection.
8. Inspect append-only audit evidence.
```

### MORROW first slice

```text
PROJECT=MORROW
MODE=BOOTSTRAP
OBJECTIVE=Store and retrieve a typed memory only when consent, purpose, tenant, subject, and retention permit it.
REQUIREMENT/ISSUE IDs=FR-MOR-001, FR-MOR-002, FR-MOR-003, FR-MOR-006
NON-GOALS=automatic transcript mining, external vector provider, full deletion workflow in first slice
```

Acceptance demonstration:

```text
1. Register consent receipt for subject/purpose.
2. Store a typed preference memory with finite retention.
3. Query under same tenant/subject/purpose -> result returned with provenance.
4. Query using another tenant, another purpose, no consent, or expired retention -> no content returned.
5. Verify read/write audit events and no raw secret in logs.
```

### VEIL first slice

```text
PROJECT=VEIL
MODE=BOOTSTRAP
OBJECTIVE=Publish a simple declarative PolicyBundle and return an auditable safe decision.
REQUIREMENT/ISSUE IDs=FR-VEI-001, FR-VEI-002, FR-VEI-005
NON-GOALS=full classifier integration, management UI, human-review queue
```

Acceptance demonstration:

```text
1. Create and validate a draft bundle.
2. Publish immutable version.
3. Submit one allowed request and one blocked request.
4. Submit unknown/timeout adapter result -> BLOCK or ESCALATE, never ALLOW.
5. Retrieve decision evidence with policy version, rule ID, input hash, and correlation ID.
```

### PULSE first slice

```text
PROJECT=PULSE
MODE=BOOTSTRAP
OBJECTIVE=Run a versioned evaluation suite against a deterministic HTTP target and fail CI on a baseline regression.
REQUIREMENT/ISSUE IDs=FR-PUL-001, FR-PUL-002, FR-PUL-003, FR-PUL-004, FR-PUL-005
NON-GOALS=production traffic ingestion, external model judge, analytics UI
```

Acceptance demonstration:

```text
1. Publish a suite containing rule/schema cases.
2. Run against a local deterministic target.
3. Store only redacted trace.
4. Create baseline.
5. Change target output to break a threshold.
6. Show regression endpoint and non-zero CLI/CI result.
```

### DRIFT first slice

```text
PROJECT=DRIFT
MODE=BOOTSTRAP
OBJECTIVE=Validate a scenario graph, create a version-pinned session, process an event, and return a minimal context pack.
REQUIREMENT/ISSUE IDs=FR-DRI-001, FR-DRI-002, FR-DRI-003, FR-DRI-004, FR-DRI-006
NON-GOALS=external action plugins, autonomous planning, direct model execution
```

Acceptance demonstration:

```text
1. Validate a graph with start/transition/end scenes.
2. Reject unreachable/duplicate/non-terminating-only cases.
3. Start session on published version.
4. Submit permitted event -> deterministic transition.
5. Submit failed guard -> no state mutation and reason code.
6. Get minimal context pack and replay event history to same end state.
```

### TETHER first slice

```text
PROJECT=TETHER
MODE=BOOTSTRAP
OBJECTIVE=Apply a declared relationship event to an explainable, versioned snapshot with idempotency.
REQUIREMENT/ISSUE IDs=FR-TET-001, FR-TET-002, FR-TET-003, FR-TET-004
NON-GOALS=emotion inference, real-world sentiment analysis, engagement optimization, scheduled decay worker
```

Acceptance demonstration:

```text
1. Validate model containing one bounded axis and allowed event rule.
2. Create relationship.
3. Apply event -> one atomically updated snapshot and explanation.
4. Replay idempotency key -> no duplicate update.
5. Attempt boundary-violating positive rule -> model validation rejects it.
```

### RELAY first slice

```text
PROJECT=RELAY
MODE=BOOTSTRAP
OBJECTIVE=Route a normalized chat request to an OpenAI-compatible local HTTP adapter only when tenant/data/capability policy permits.
REQUIREMENT/ISSUE IDs=FR-REL-001, FR-REL-002, FR-REL-005, FR-REL-006
NON-GOALS=multi-provider failover, tool execution, provider-specific SDKs, model training
```

Acceptance demonstration:

```text
1. Configure one local OpenAI-compatible adapter through secret reference.
2. Resolve route dry-run showing matched capability and policy constraints.
3. Send permitted chat request -> normalized response and usage record.
4. Send disallowed data-classification/capability request -> rejection before outbound HTTP call.
5. Confirm secret cannot appear in config export, log, error, or fixture.
```

---

## 12. Cross-Repository Integration Later (Not P0)

When at least three repositories reach stable v0.1 contracts, create a separate **reference integration** repository. It proves composition without forcing package-level coupling.

Reference flow:

```text
Client
  -> VEIL pre-decision
  -> ASTER compiled persona/context contract
  -> MORROW consent-filtered retrieval
  -> DRIFT session context pack (optional)
  -> TETHER explainable state reference (optional)
  -> RELAY selected model/provider
  -> VEIL post-decision / transform / confirmation
  -> MORROW explicit approved memory write
  -> PULSE offline/CI evaluation against stable cases
```

Integration rules:

- Every handoff uses explicit versioned request/response contracts.
- Only identifiers and policy-approved content move between components.
- Policy, consent, and data classification are propagated and never silently dropped.
- A downstream failure must not trigger broader data sharing, a permissive policy outcome, or duplicated side effect.
- The reference integration is a testbed and documentation example, not an attempt to create a hidden eighth core platform.

---

## 13. Private-by-Default Repository Hygiene and Publication Firewall

### 13.1 Public repository allowlist

A public release should contain only material that an external user or contributor needs to use, verify, secure, or contribute to the released software. The default allowlist is:

```text
LICENSE                    # complete Apache-2.0 text, not a placeholder
README.md                  # public-safe product and operating documentation
SECURITY.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
CHANGELOG.md
docs/adr/                   # selectively redacted public ADRs only
docs/runbooks/              # public-safe runbooks only
openapi/openapi.yaml        # or documented generated equivalent
src/, apps/, packages/, tests/, scripts/
CI configuration and dependency lockfiles
```

The following are explicitly **not** public release materials:

```text
CODEX_AI_COMPANION_OSS_IMPLEMENTATION_HARNESS.md
CODEX_IMPLEMENTATION_HARNESS.md
AGENTS.private.md
.private/
.codex-private/
private-ai-control-plane/
docs/00_GLOSSARY.md
docs/01_BMA.md
docs/02_StRS.md
docs/03_SyRS.md
docs/04_AD.md
docs/05_DD.md
docs/06_API_CONTRACT.md
docs/07_VV_PLAN.md
docs/08_TRACEABILITY.md
docs/09_MVP_BACKLOG.md
docs/10_RELEASE_CRITERIA.md
docs/ai/
docs/private/
private test corpora, raw conversation exports, local databases, model prompts, evidence archives
```

Do not solve this by making the GitHub repository private forever. The intended model is: **the code repository can be public; the operator control plane remains local and separate.**

### 13.2 Secondary Git, package, container, and CI tripwires

Add and maintain an intentionally conservative ignore policy in every public repository. Adjust only after a conscious review; never weaken it merely to make a local file easier to access.

```gitignore
# Private AI operator material — must remain outside this worktree in normal use
/.private/
/.codex-private/
/private-ai-control-plane/
/CODEX_AI_COMPANION_OSS_IMPLEMENTATION_HARNESS.md
/CODEX_IMPLEMENTATION_HARNESS.md
/AGENTS.private.md

# Accidental in-repo copies of the private requirements corpus
/docs/00_GLOSSARY.md
/docs/01_BMA.md
/docs/02_StRS.md
/docs/03_SyRS.md
/docs/04_AD.md
/docs/05_DD.md
/docs/06_API_CONTRACT.md
/docs/07_VV_PLAN.md
/docs/08_TRACEABILITY.md
/docs/09_MVP_BACKLOG.md
/docs/10_RELEASE_CRITERIA.md
/docs/ai/
/docs/private/

# Local data and private evidence
/.local-data/
/evidence-private/
/private-fixtures/
*.private.md
*.private.json
*.private.yaml
*.private.yml
```

Add corresponding exclusions to `.dockerignore` and, when publishing packages, `.npmignore`. Do not rely on `.gitignore` to control Docker build context or npm package contents; each system has different inclusion semantics.

Recommended Docker/npm exclusions:

```text
.private
.codex-private
private-ai-control-plane
CODEX_AI_COMPANION_OSS_IMPLEMENTATION_HARNESS.md
CODEX_IMPLEMENTATION_HARNESS.md
AGENTS.private.md
docs/00_GLOSSARY.md
docs/01_BMA.md
docs/02_StRS.md
docs/03_SyRS.md
docs/04_AD.md
docs/05_DD.md
docs/06_API_CONTRACT.md
docs/07_VV_PLAN.md
docs/08_TRACEABILITY.md
docs/09_MVP_BACKLOG.md
docs/10_RELEASE_CRITERIA.md
docs/ai
docs/private
.local-data
evidence-private
private-fixtures
```

These files are preventive controls, not proof. A previously committed private file remains in Git history even after it becomes ignored. Detecting prior exposure is a release blocker.

### 13.3 Mandatory private-boundary preflight

Before any commit, pull request, tag, package publish, Docker push, or GitHub release, Codex must execute or request execution of a privacy preflight. It checks all of the following:

1. Private paths resolve outside `PUBLIC_REPO_ROOT`.
2. `git status --short` contains no unexpected private file.
3. `git ls-files` finds no prohibited path, private marker, raw transcript, local database, or private fixture.
4. The staged diff contains only explicitly selected public-safe files. Blanket staging commands are prohibited.
5. `.gitignore`, `.dockerignore`, and `.npmignore` protect accidental copies.
6. Package dry-run and Docker build context do not include prohibited paths.
7. CI artifacts and logs do not upload private work directories, model prompts, raw conversation records, or unredacted evidence.
8. All public docs and public-facing reports have been reviewed for near-verbatim copying from private requirements.
9. The Git history check shows no prior commit of the private corpus. If it does, stop release work and treat it as a potential disclosure incident.

Codex must write the detailed preflight result only to `PRIVATE_WORKDIR/EXECUTION_LEDGER.md`. A public PR description may say only: “Private-material boundary check: passed” when that statement is true. It must never paste command output containing private paths, file names, or content.

### 13.4 Required public repository guard

Implement a small, deterministic repository guard such as `scripts/check-private-boundary.mjs`. It must be runnable locally and in CI and must fail closed. The guard should:

- obtain the Git-tracked and staged file names;
- reject prohibited names/path prefixes from Section 13.1;
- reject files containing a private marker such as `PRIVATE_SPECIFICATION_DO_NOT_COMMIT` or `PRIVATE_OPERATOR_MATERIAL`;
- reject common high-risk material, including `.env` files other than intentionally committed `.env.example`, SQLite/PostgreSQL dumps, raw JSONL conversation exports, and private evidence directories;
- inspect package contents with the package manager’s dry-run command when the repository publishes a package;
- be conservative: a scanner error or inability to determine the tracked/staged file set is a failure, not a pass.

The guard source code and its allowlist/denylist are public-safe because they contain only generic protection patterns. It must not embed the private requirements corpus, unreleased roadmap, customer names, real secrets, or proprietary prompt text.

### 13.5 Git discipline for Codex

Codex must follow these rules without exception unless the current user explicitly overrides a specific rule:

- Do not run `git add .`, `git add -A`, `git commit -a`, broad `git stash`, or a repository-wide copy command.
- Stage only named, reviewed public-safe files: `git add <explicit-path> ...`.
- Before any commit, inspect the staged names and staged diff. A clean test suite does not replace a privacy review.
- Do not create a commit, push a branch, open a PR, tag, publish a package, push an image, or create a release unless the user explicitly asks for that action in the current session.
- Never “fix” an ignore rule by forcing an ignored private file into Git.
- Never move a private requirement document into the repository so that tooling can read it. Configure tooling with an external local path or work from a private parent directory.
- Never record absolute private paths in source code, README files, issue text, test output, CI configuration, Docker labels, telemetry, or screenshots.
- In a Codex chat response, refer to private sources by generic labels such as “private requirements corpus” or “private work log,” not by copying content or local filesystem paths.

### 13.6 Historical exposure protocol

A private document that was previously committed, pushed, attached to a release, published in a package/image, or pasted in a public issue is not fixed by adding it to `.gitignore`.

When an exposure is detected:

1. Stop further publication and do not make claims that it is resolved.
2. Preserve only the minimum local evidence necessary to assess scope; do not spread the content while investigating.
3. Identify affected refs, tags, packages, image layers, CI artifacts, caches, forks, and public issue/PR surfaces.
4. Revoke or rotate any credential or secret that may have been exposed.
5. Remove the material from current branches and release artifacts. History rewriting, package/image revocation, and disclosure communication require an explicit owner decision because they can be disruptive and may not erase copied data.
6. Record the incident assessment and remediation plan in the private work log, not in a public commit message.
7. Resume release work only after the user or authorized owner approves the remediation path.

### 13.7 Dependency discipline

Before adding a dependency, record in the private ledger:

```text
name, version/range, license, purpose, alternative considered, core-or-adapter location, maintenance/security concern
```

Pin/lock deterministic builds. Prefer standard platform APIs and existing dependencies when practical. Avoid adding a framework solely to save a few lines where it increases operational surface area.


### 13.8 CI, package, container, and release supply-chain rules

A public repository’s CI must behave as though the private control plane does not exist.

- GitHub Actions, reusable workflows, release automation, package publication, Docker builds, documentation builds, dependency bots, and code-scanning jobs must never receive `PRIVATE_AI_ROOT`, `PRIVATE_HARNESS`, `PRIVATE_REQUIREMENTS_DIR`, `PRIVATE_WORKDIR`, or `PRIVATE_EVIDENCE_DIR`.
- Do not upload workspace-wide archives, `.` as an artifact path, `~`, tool caches that may contain private prompts, local databases, test recordings, or terminal transcripts.
- Docker builds must use a narrowly scoped context and a `.dockerignore` that excludes all local/private paths. Inspect the final image for unexpected files before publishing.
- Package publication must use explicit `files` allowlists or equivalent packaging rules wherever supported. A package dry-run is required before release.
- Documentation generators must use only public repository inputs. Do not configure them to ingest parent directories, user home directories, private work logs, or arbitrary Markdown globs.
- Generated OpenAPI, SDK, test reports, coverage artifacts, snapshots, source maps, and error examples are public release material when uploaded. Redact or exclude paths and data accordingly.
- Public GitHub issue templates, PR templates, CI logs, and release notes must tell contributors not to paste secrets, production conversation data, or private operator material. They must not name or describe the private corpus.

### 13.9 Mechanical privacy-preflight procedure

Run this procedure locally from the selected `PUBLIC_REPO_ROOT` before any public commit, push, PR, tag, package publish, image push, or GitHub release. Keep detailed outputs under `PRIVATE_WORKDIR`; do not attach them to public surfaces.

```bash
# 1) Confirm the selected public repository and detect nesting/symlink ambiguity.
git rev-parse --show-toplevel
git status --short
git submodule status || true
git worktree list

# 2) Review only staged material; broad staging is prohibited.
git diff --cached --name-only
git diff --cached --check
git diff --cached

# 3) Confirm no disallowed paths are currently tracked.
if git ls-files \
  | grep -Eq '(^|/)(CODEX(_AI_COMPANION_OSS)?_IMPLEMENTATION_HARNESS\.md|AGENTS\.private\.md|00_GLOSSARY\.md|01_BMA\.md|02_StRS\.md|03_SyRS\.md|04_AD\.md|05_DD\.md|06_API_CONTRACT\.md|07_VV_PLAN\.md|08_TRACEABILITY\.md|09_MVP_BACKLOG\.md|10_RELEASE_CRITERIA\.md|private-ai-control-plane|\.private|\.codex-private|docs/(ai|private))($|/)'; then
  echo "PRIVATE BOUNDARY FAIL"
  exit 1
fi

# 4) Execute the public repository guard and normal quality gates.
pnpm run check:private-boundary
pnpm lint
pnpm test
pnpm run build
```

The exact commands may differ by repository, but the properties do not: deterministic path check, explicit staged-file review, tracked-file denylist check, public guard, real quality gates, package/image inspection where applicable, and no “pass” conclusion when a scanner was not run.

A grep-based check is a useful tripwire, not a complete confidentiality proof. It cannot prove that a private idea was paraphrased into public documentation. That is why a human/operator review of public-facing prose and generated artifacts remains mandatory.

### 13.10 Public documentation boundary

Public OSS documentation should be concise and operational:

- **Allowed**: What the released code does, its stable API, installation, configuration, threat-relevant user responsibilities, limitations, contribution workflow, public architecture, and how to report vulnerabilities.
- **Not allowed**: The original BMA/StRS/SyRS/AD/DD corpus, traceability maps, private requirement identifiers, private product strategy, unreleased roadmap, internal scoring criteria, market research, private test/evaluation prompts, raw security findings, private paths, or Codex orchestration instructions.
- **Rule of interpretation**: A public reader must be able to use and contribute to the project without receiving the private reasoning system that created it.

When a public document feels like it needs a requirement-specification hierarchy or a private implementation instruction to be understood, rewrite it around the released behavior. Do not make the private document public to resolve a documentation gap.


## 14. Final Implementation Report Format

At the end of each Codex session, return this format exactly enough to be auditable. The response must not quote private requirements, private paths, private prompts, internal strategy, or raw private evidence. Use requirement IDs only in the local private work log; in a public-facing report use a neutral feature label.

```markdown
## Result
- Status: COMPLETE | PARTIAL | BLOCKED
- Project / mode:
- Public-safe feature label addressed:

## What changed
- <file>: <purpose>

## Evidence
- Primary flow:
- Security/failure behavior:
- Tests added:

## Commands run
- `<command>` — PASS | FAIL | NOT RUN

## Compatibility and operations
- API/OpenAPI/SDK impact:
- Migration/rollback or recovery impact:
- Configuration/secrets impact:

## Assumptions and known limitations
- <explicit items only>

## Next highest-value task
- <one concrete task with requirement/issue ID>
```

A `COMPLETE` status requires executed evidence for the selected scope. Use `PARTIAL` when a coherent subset is delivered but the stated objective is not fully met. Use `BLOCKED` only for a concrete blocker, with attempted steps and the smallest decision/input needed to proceed.

---

## 15. The One-Sentence Operating Standard

> Build each repository as an independent, small, composable, commercially usable, self-hostable system whose behavior is explicit, versioned, tenant-safe, consent/policy-aware where relevant, reproducible in tests, observable in operation, safer when uncertain than when falsely confident; keep the private harness, original requirements corpus, strategy, traceability, prompts, and evidence outside every public worktree and entirely outside the public OSS supply chain.
