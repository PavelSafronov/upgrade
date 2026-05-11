# Design: MongoDB Upgrade Toolkit

**Date:** 2026-05-11
**Author:** Pavel Safronov + Claude (brainstorming session)
**Status:** Approved — ready for implementation planning

---

## Overview

A two-package monorepo delivering a deterministic codemod CLI and an MCP server for AI agents. Together they help customers upgrade the MongoDB Node.js driver from old majors to current, meeting them in their existing toolchain.

**Packages:**
- `@mongodb-js/upgrade` — deterministic codemod CLI (no LLM, no network)
- `@mongodb-js/upgrade-mcp` — MCP server wrapping the CLI for AI agents

**Phase 1 scope (this week):** v6 → v7 transforms only. Architecture is designed to extend to v5→v6 and Mongoose without structural changes.

---

## Repository Structure

```
code/upgrade/
├── package.json                    # npm workspace root
├── DECISIONS.md                    # timestamped decision log
├── packages/
│   ├── cli/                        # @mongodb-js/upgrade
│   │   ├── src/
│   │   │   ├── index.ts            # CLI entrypoint (commander)
│   │   │   ├── detect.ts           # version detection from package.json + lockfile
│   │   │   ├── plan.ts             # staged upgrade plan (hop table)
│   │   │   ├── runner.ts           # orchestrates codemods + env checks + report
│   │   │   ├── report.ts           # terminal output + upgrade-report.json
│   │   │   ├── catalog/
│   │   │   │   ├── index.ts        # catalog registry (all codemods)
│   │   │   │   ├── types.ts        # Codemod, EnvCheck interfaces
│   │   │   │   ├── v7/             # v6→v7 codemods (Phase 1)
│   │   │   │   └── v6/             # v5→v6 codemods (Phase 2, stubbed)
│   │   │   └── env/                # environmental checks (non-AST)
│   │   ├── test/
│   │   └── package.json
│   ├── mcp/                        # @mongodb-js/upgrade-mcp
│   │   ├── src/
│   │   │   ├── index.ts            # MCP stdio server entrypoint
│   │   │   └── tools/              # one file per MCP tool
│   │   ├── test/
│   │   └── package.json
│   ├── test-app-v6/                # kitchen-sink: v6→v7 patterns (Phase 1, fully populated)
│   │   ├── src/index.ts            # every v6→v7 deprecated API in one file
│   │   └── package.json            # mongodb@6.20.0, node>=16
│   ├── test-app-v5/                # kitchen-sink: v5→v6 patterns (Phase 2, scaffolded)
│   │   ├── src/index.ts            # v5→v6 deprecated APIs (addUser, collStats, ssl*, keepAlive, etc.)
│   │   └── package.json            # mongodb@5.8.1, node>=14
│   ├── test-app-v4/                # kitchen-sink: v4→v5 patterns (Phase 2, scaffolded)
│   │   ├── src/index.ts            # v4→v5 deprecated APIs (callbacks, Collection.insert/update/remove, ObjectID, etc.)
│   │   └── package.json            # mongodb@4.13.0 (latest 4.x)
│   └── test-app-v4.2/             # kitchen-sink: absolute floor (Phase 2, scaffolded)
│       ├── src/index.ts            # same v4→v5 patterns, pinned to minimum supported 4.2.x
│       └── package.json            # mongodb@4.2.0 (lowest supported 4.2)
└── docs/
    └── superpowers/specs/          # design docs
```

---

## Tooling

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript throughout | Matches driver team conventions |
| Build | `tsup` (ESM + CJS) | Zero-config, fast, dual output |
| Monorepo | `npm workspaces` | No extra tooling overhead |
| AST transforms | `jscodeshift` | Industry standard; React/Next.js/AI SDK all use it; large ecosystem of reference transforms |
| Pattern matching | `ast-grep` | Cross-file detection complement to jscodeshift |
| Tests | `vitest` | Fast, no MongoDB needed |
| MCP runtime | `@modelcontextprotocol/sdk` | Official SDK, stdio transport |
| Diff formatting | `prettier` | Clean, reviewable output |

---

## CLI Design

### Commands

```bash
npx @mongodb-js/upgrade                        # full upgrade, all hops
npx @mongodb-js/upgrade --dry-run              # show diff, no writes
npx @mongodb-js/upgrade --only=stream-transform # single named codemod
npx @mongodb-js/upgrade --list                 # print catalog with classifications
npx @mongodb-js/upgrade --from=6 --to=7        # explicit version bounds
```

### Execution Flow

```
1. detect()     → read package.json + lockfile → { package: "mongodb", current: "6.21.0" }
2. plan()       → staged hops table → [{ from: "6.x", to: "7.x", codemods: [...] }]
3. for each hop:
   a. env checks     → Node version, peer deps → errors/warnings (no AST)
   b. mechanical     → jscodeshift transforms → diffs applied to disk
   c. semantic flags → jscodeshift detectors  → TODO comments inserted inline
4. report()     → colored terminal output + upgrade-report.json written to cwd
```

### Catalog Entry Interface

```ts
interface Codemod {
  id: string;                          // e.g. "stream-transform"
  description: string;
  kind: 'mechanical' | 'semantic' | 'env';
  hop: { from: string; to: string };   // e.g. { from: "6.x", to: "7.x" }
  packages: string[];                  // ["mongodb"] — extensible to ["mongoose"]
  transform?: Transform;               // jscodeshift fn (mechanical + semantic)
  check?: EnvCheck;                    // env check fn
}
```

### Report Output

**Terminal:** colored summary with per-file breakdown.

**`upgrade-report.json`:**
```json
{
  "package": "mongodb",
  "from": "6.21.0",
  "to": "7.0.0",
  "summary": { "mechanical": 12, "flagged": 3, "env": 2 },
  "changes": [
    { "codemod": "stream-transform", "file": "src/db.ts", "line": 42, "status": "applied" },
    { "codemod": "aws-explicit-credentials", "file": "src/client.ts", "line": 8, "status": "flagged", "note": "Explicit AWS credentials in URI must be removed; credentials are now fully managed by @aws-sdk/credential-providers." }
  ]
}
```

---

## v6 → v7 Codemod Catalog

Source of truth: `node-mongodb-native/etc/notes/CHANGES_7.0.0.md`

### Mechanical — auto-applied, clean diff

| ID | What it transforms |
|---|---|
| `stream-transform` | `cursor.stream({ transform: fn })` → `cursor.stream().map(fn)` |
| `pool-retry-label` | `'PoolRequstedRetry'` → `'PoolRequestedRetry'` (typo fix in string literals) |
| `remove-no-response` | Removes `noResponse` property from options objects |
| `remove-use-new-url-parser` | Removes `useNewUrlParser` from MongoClient options |
| `remove-use-unified-topology` | Removes `useUnifiedTopology` from MongoClient options |
| `remove-gridfs-deprecated` | Removes `contentType` and `aliases` from GridFS options and file objects |
| `remove-deprecated-types` | Removes imports + usages of: `CloseOptions`, `ResumeOptions`, `CancellationToken`, `Transaction`, `ServerCapabilities`, `ClientMetadataOptions` |
| `find-options-generic` | `FindOptions<TSchema>` → `FindOptions` (generic removed from type) |
| `find-one-options` | Removes `batchSize`, `limit`, `noCursorTimeout` from `FindOneOptions` usage |
| `remove-command-retry-writes` | Flags `CommandOperationOptions.retryWrites` (option moved to MongoClient level) |
| `remove-beta-namespace` | `import ... from 'mongodb/beta'` → `import ... from 'mongodb'` |
| `remove-read-preference-wire` | Removes `ReadPreference.minWireVersion` access |
| `remove-client-session-transaction` | Removes `session.transaction` property access |

### Semantic — TODO comment inserted, needs human or agent resolution

| ID | What it flags | Why it can't auto-fix |
|---|---|---|
| `aws-explicit-credentials` | MongoClient URI with embedded AWS key/secret | Credentials must move to env/SDK; correct fix depends on deployment |
| `mongodb-cr-auth` | `authMechanism: 'MONGODB-CR'` | No drop-in replacement; customer must choose a supported mechanism |
| `client-metadata-props` | `.additionalDriverInfo`, `.metadata`, `.extendedMetadata` on MongoOptions | Internal API; callers need to audit why they accessed it |
| `cursor-implicit-batch-size` | Explicit `batchSize: 1000` on cursors | May have been compensating for the now-removed default — needs intent check |
| `aws-sdk-required` | Any MONGODB-AWS usage | Customer must install `@aws-sdk/credential-providers` and audit credential flow |

### Environmental — preflight checks, no AST

| ID | What it checks | Fix applied |
|---|---|---|
| `node-version` | `engines.node` in package.json | Updated to `>=20.19.0` |
| `mongodb-dep-bump` | `mongodb` version in package.json | Bumped to `^7.0.0` |
| `bson-dep-bump` | direct `bson` dependency if present | Bumped to `^7.0.0` |
| `peer-dep-kerberos` | `kerberos` peer dep if present | Bumped to `^7.0.0` |
| `peer-dep-zstd` | `@mongodb-js/zstd` peer dep if present | Bumped to `^7.0.0` |
| `peer-dep-encryption` | `mongodb-client-encryption` if present | Bumped to `^7.0.0` |

---

## Test Strategy

### Layer 1 — Unit fixture tests (CI, per-codemod)

Each codemod directory contains:
```
catalog/v7/stream-transform/
  transform.ts
  __fixtures__/
    input.ts      ← code using the deprecated API
    expected.ts   ← expected output after transform
```
`vitest` runs the transform against `input.ts` and asserts output matches `expected.ts`. No MongoDB, no network.

### Layer 2 — Kitchen-sink integration test apps (one per supported starting version)

Four TypeScript apps committed to the monorepo, each pinned to a specific driver version and populated with deprecated patterns for the next hop in the upgrade path.

| App | Pin | Deprecated patterns | Phase |
| --- | --- | --- | --- |
| `packages/test-app-v6/` | `mongodb@6.20.0` | v6→v7 catalog (all 13 mechanical + 5 semantic) | **1 — fully populated** |
| `packages/test-app-v5/` | `mongodb@5.8.1` | v5→v6 catalog (addUser, collStats, ssl*, keepAlive, BulkWriteResult aliases, etc.) | 2 — scaffolded |
| `packages/test-app-v4/` | `mongodb@4.13.0` | v4→v5 catalog (callbacks, Collection.insert/update/remove, mapReduce, ObjectID, slaveOk) | 2 — scaffolded |
| `packages/test-app-v4.2/` | `mongodb@4.2.0` | same as v4 but pinned to the absolute lowest supported 4.2.x | 2 — scaffolded |

Each app is committed to git with all deprecated patterns in place. When the CLI runs against it, `git diff` shows exactly what was transformed and where TODO comments were inserted — this is both the integration test assertion and the demo artifact.

"Scaffolded" means the file exists with comments marking where each category of patterns will go in Phase 2. The CLI runs against them without error in Phase 1 (nothing to transform yet).

### Layer 3 — Real-world smoke tests (manual / demo)

- `code/testProject/` (already on `mongodb@^6.19.0`) — run the CLI, verify TypeScript compiles clean after
- GitHub search for open-source repos with `"mongodb": "^6"` — clone, run, compile-check
- `code/docs-node/` driver documentation examples — real usage patterns to validate against

---

## MCP Server Design

**Transport:** stdio (standard for Claude Code, Cursor, Copilot — no port, no auth)

**Agent config:**
```json
{
  "mcpServers": {
    "mongodb-upgrade": {
      "command": "npx",
      "args": ["@mongodb-js/upgrade-mcp"]
    }
  }
}
```

### Tools (Phase 1 — this week)

**`analyze_repo`**
- Input: `{ path: string }`
- Output: current version, target version, staged plan, file-by-file breakdown of issues
- Purpose: agent calls this first to understand scope before touching anything

**`apply_codemod`**
- Input: `{ path: string, codemod: string, dryRun?: boolean }`
- Output: `{ status, diff, report: Change[] }`
- Purpose: surgical or bulk application; `dryRun` lets agent show diff before committing

**`explain_breaking_change`**
- Input: `{ id: string }` (e.g. `"stream-transform"`)
- Output: `{ description, before, after, notes, docsUrl }`
- Purpose: agent enriches TODO comments with canonical explanation + migration example

### Tools deferred to Phase 3

- `verify_upgrade` — run customer test suite, map failures to migration issues
- `migrate_callbacks_to_promises` — v5 callback removal (agent-driven, Phase 2/3)

### Typical agent interaction

```
User: "Help me upgrade my MongoDB driver"
Agent → analyze_repo({ path: "." })
Agent → explain_breaking_change({ id: "stream-transform" })
Agent → apply_codemod({ path: ".", codemod: "stream-transform", dryRun: true })
[Agent shows diff, user approves]
Agent → apply_codemod({ path: ".", codemod: "stream-transform" })
... repeat per codemod ...
Agent summarizes applied transforms + TODO comments needing human attention
```

---

## Extensibility

The catalog format is package-agnostic from day one:

```ts
// Today
{ packages: ["mongodb"], hop: { from: "6.x", to: "7.x" } }

// Future — no architectural change needed
{ packages: ["mongoose"], hop: { from: "7.x", to: "8.x" } }
```

Mongoose support is a new catalog entry, not a new architecture.

---

## Out of Scope (Phase 1)

- Bespoke web app or hosted upgrade service
- Full agentic assistant (customers already have agents)
- LLM calls from inside the CLI
- v5→v6 transforms (Phase 2)
- `verify_upgrade` MCP tool (Phase 3)
- ESLint plugin (Phase 4)
- Atlas in-product nudge (requires Atlas team buy-in)
