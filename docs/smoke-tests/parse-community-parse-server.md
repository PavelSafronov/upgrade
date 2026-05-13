# Smoke Test: parse-community/parse-server

**Date:** 2026-05-13
**Repo:** https://github.com/parse-community/parse-server
**Approach:** Historical analysis — found the 6→7 upgrade commit, checked out the pre-upgrade state
**CLI version:** @pavel-safronov/upgrade@0.1.5

---

## The upgrade commit

```
14b3fce2  feat: Upgrade mongodb from 6.20.0 to 7.0.0 (#10027)
Author: dependabot[bot]
Date:   Thu Jan 29 13:31:32 2026 +0100
Files changed: package.json, package-lock.json (2 files)
```

The upgrade was **Dependabot-only** — no source code changes. This is the baseline expectation: our CLI should also produce zero source transforms on the pre-upgrade state.

**Pre-upgrade commit analyzed:** `73e21e77` (refactor: Bump bcryptjs, the commit immediately before)
**mongodb version at analysis:** `6.20.0`

---

## Bugs found during this analysis

Both bugs were fixed before recording final results.

### Bug 1 — CLI crashed on unparseable files

Before fix, the CLI aborted with a babel parse error on the first file that contained Flow type annotations. The process exited non-zero with no output.

**Fix:** Wrapped `codemod.transform!()` in a try/catch in `runner.ts`. Parse errors are now caught per-file and logged to stderr, then skipped.

### Bug 2 — Same warning repeated per codemod

After the crash fix, the same file was warned once per codemod (19 files × 14 codemods = 266 warning lines).

**Fix:** Added a `parseErrors: Set<string>` to deduplicate — each file is warned once, then silently skipped in subsequent codemod iterations.

---

## CLI result (post-fix, dry-run)

```
  ⚠ parse error, skipping src/SchemaMigrations/Migrations.js
  ⚠ parse error, skipping src/SchemaMigrations/DefinedSchemas.js
  ⚠ parse error, skipping src/Push/PushWorker.js
  ⚠ parse error, skipping src/Options/index.js
  ⚠ parse error, skipping src/GraphQL/ParseGraphQLSchema.js
  ⚠ parse error, skipping src/Controllers/types.js
  ⚠ parse error, skipping src/Controllers/SchemaController.js
  ⚠ parse error, skipping src/Controllers/ParseGraphQLController.js
  ⚠ parse error, skipping src/Controllers/LiveQueryController.js
  ⚠ parse error, skipping src/Controllers/DatabaseController.js
  ⚠ parse error, skipping src/GraphQL/loaders/parseClassTypes.js
  ⚠ parse error, skipping src/GraphQL/loaders/parseClassQueries.js
  ⚠ parse error, skipping src/GraphQL/loaders/parseClassMutations.js
  ⚠ parse error, skipping src/Adapters/Storage/StorageAdapter.js
  ⚠ parse error, skipping src/Adapters/Push/PushAdapter.js
  ⚠ parse error, skipping src/Adapters/Files/GridFSBucketAdapter.js
  ⚠ parse error, skipping src/Adapters/Files/FilesAdapter.js
  ⚠ parse error, skipping src/Adapters/Storage/Postgres/PostgresStorageAdapter.js
  ⚠ parse error, skipping src/Adapters/Storage/Mongo/MongoStorageAdapter.js

[dry-run] MongoDB driver upgrade: 6.20.0 → 7.x

  ⚠ package.json — mongodb-dep-bump [flagged]

  0 transforms applied  1 env checks updated
```

**Result matches expectation:** 0 source transforms, consistent with the Dependabot-only actual upgrade.

---

## Why 19 files fail to parse: Flow type annotations

parse-server uses **Flow** (not TypeScript) for type annotations in JavaScript files. All files begin with `// @flow` and use Flow-specific syntax:

```js
// @flow
import type { QueryOptions, QueryType, SchemaType, StorageClass } from '../StorageAdapter';
// ...
_logClientEvents: ?Array<any>;  // Flow nullable type
```

Our jscodeshift parser is configured as `tsx` (TypeScript + JSX). It cannot parse Flow's `?Array<any>` nullable syntax or `import type` in Flow's specific encoding.

**Critically, all of the MongoDB-consuming files are Flow files:**
- `MongoStorageAdapter.js` — main driver consumer
- `GridFSBucketAdapter.js` — GridFS
- `DatabaseController.js` — query layer
- `PostgresStorageAdapter.js` — (unrelated, but same issue)

This means we cannot verify whether our codemods would produce false positives or true positives on parse-server's actual MongoDB usage. The grep check (below) provides indirect confidence.

---

## Missed items (grep check)

Grepped for all v6→v7 patterns across all `.{js,ts}` files (excluding `node_modules`):

| Pattern | Hits |
|---|---|
| `useNewUrlParser` / `useUnifiedTopology` | 0 |
| `.stream({ transform` | 0 |
| `mongodb/beta` | 0 |
| `FindOptions<` | 0 |
| `socketTimeoutMS` / `waitQueueTimeoutMS` | 0 |

Zero hits — consistent with the zero-diff upgrade. parse-server was already v7-clean.

---

## Verdict

**Correct result, but limited visibility.** Our CLI correctly produces zero source transforms on a codebase that needed zero source changes. However, we cannot fully verify the codemods because all MongoDB-touching files are Flow files that we skip.

---

## Findings / Action items

| Finding | Impact | Recommendation |
|---|---|---|
| CLI crashes on first parse error | Critical bug — fixed in this session | Done |
| Parse error warning repeated per codemod | UX — noisy output — fixed in this session | Done |
| Flow type annotations incompatible with `tsx` parser | Coverage gap — 19 files skipped including all MongoDB adapters | Consider adding `@babel/plugin-syntax-flow` as a fallback parser when `tsx` fails |
| Upgrade was Dependabot-only (no source changes) | Positive signal — CLI is correct | No action; confirms result |

---

## Notes

- parse-server uses `require('mongodb')` (not ESM) inside the Flow files, so the import guard would pass if we could parse them
- The project is actively maintained and likely to keep mongodb pinned to latest; useful for regression checks over time
- A follow-up: try the Flow babel plugin on these files to determine if our codemods would have produced any hits on the actual MongoDB adapter code
