# @mongodb-js/upgrade

Deterministic codemod CLI for upgrading the MongoDB Node.js driver. Detects your current version from `package.json`, plans a staged multi-hop upgrade path, applies mechanical transforms automatically, inserts `TODO` comments for issues that require human judgment, and runs preflight environment checks.

No LLM. No network calls (beyond `npm install`). Every transform is tested against input/output fixtures.

## Install

```bash
npm install -D @mongodb-js/upgrade
# or run without installing:
npx @mongodb-js/upgrade
```

## Usage

```bash
# Run from your project root (auto-detects mongodb version):
npx @mongodb-js/upgrade

# Flags:
npx @mongodb-js/upgrade --dry-run              # show what would change, write nothing
npx @mongodb-js/upgrade --list                 # list all registered codemods
npx @mongodb-js/upgrade --only stream-transform  # run one codemod by ID
npx @mongodb-js/upgrade --from 6 --to 7        # override version detection
npx @mongodb-js/upgrade /path/to/project       # specify project path explicitly
```

After a real run, `upgrade-report.json` is written to the project root with a machine-readable summary.

## v6 → v7 codemod catalog

### Mechanical (auto-applied)

These transforms are deterministic and safe to apply without review.

| ID | What it does |
| --- | --- |
| `stream-transform` | `cursor.stream({ transform: fn })` → `cursor.stream().map(fn)` |
| `pool-retry-label` | Fixes typo `PoolRequstedRetry` → `PoolRequestedRetry` |
| `remove-beta-namespace` | `import ... from 'mongodb/beta'` → `import ... from 'mongodb'` |
| `remove-client-options` | Removes `useNewUrlParser`, `useUnifiedTopology`, `noResponse`, `retryWrites` from option objects |
| `remove-deprecated-types` | Strips removed type imports: `CloseOptions`, `CancellationToken`, `Transaction`, `ResumeOptions`, `ServerCapabilities`, `ClientMetadataOptions`, `FindOneOptions` |
| `remove-gridfs-deprecated` | Removes `contentType` and `aliases` from GridFS write stream options |
| `find-one-options` | Removes `batchSize`, `limit`, `noCursorTimeout` from `FindOneOptions` usage |
| `find-options-generic` | `FindOptions<T>` → `FindOptions` (removes the type parameter) |
| `remove-property-access` | `ReadPreference.minWireVersion` and `session.transaction` → `undefined` + TODO comment |

### Semantic (inserts TODO comments)

These transforms detect patterns that cannot be automatically fixed. They insert a `// TODO(mongodb-upgrade): ...` comment on the line before the affected code for human review.

| ID | What it flags |
| --- | --- |
| `aws-explicit-credentials` | MONGODB-AWS URIs with embedded `user:pass@` credentials |
| `mongodb-cr-auth` | `authMechanism: 'MONGODB-CR'` usage |
| `client-metadata-props` | Access to `additionalDriverInfo`, `extendedMetadata` on client options |
| `cursor-implicit-batch-size` | `batchSize: 1000` (may have been compensating for the removed default) |

### Environmental checks (auto-applied to package.json)

| ID | What it does |
| --- | --- |
| `node-version` | Updates `engines.node` to `>=20.19.0` if needed |
| `mongodb-dep-bump` | Bumps `mongodb` dependency to `^7.0.0` |
| `bson-dep-bump` | Bumps `bson` to `^7.0.0` if present |
| `peer-dep-kerberos` | Bumps `kerberos` to `^7.0.0` if present |
| `peer-dep-zstd` | Bumps `@mongodb-js/zstd` to `^7.0.0` if present |
| `peer-dep-encryption` | Bumps `mongodb-client-encryption` to `^7.0.0` if present |

## Library API

The CLI is also importable as a library (used by the MCP server):

```typescript
import { detect } from '@mongodb-js/upgrade/detect';
import { buildPlan } from '@mongodb-js/upgrade/plan';
import { getCatalog, getById } from '@mongodb-js/upgrade/catalog/index';
import { runCodemods, runEnvChecks } from '@mongodb-js/upgrade/runner';
import { buildReport, printReport } from '@mongodb-js/upgrade/report';
```

## Development

```bash
cd packages/cli
npm install
npm run build    # tsup: ESM + CJS + .d.ts
npm test         # vitest: 46 tests across 14 test files
npm run dev      # watch mode
```

### Adding a new codemod

1. Create a directory under `src/catalog/v7/<your-id>/`
2. Add `__fixtures__/input.ts` and `__fixtures__/expected.ts`
3. Write `transform.test.ts` (fixture comparison + edge cases)
4. Write `transform.ts` (jscodeshift transform, `tsx` parser mode)
5. Register in `src/catalog/index.ts`

### Test structure

- `src/*.test.ts` — unit tests for detect, plan, runner
- `src/catalog/v7/*/transform.test.ts` — per-codemod fixture tests
- `src/integration.test.ts` — end-to-end test against `packages/test-app-v6`
