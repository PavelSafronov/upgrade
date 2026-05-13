# @pavel-safronov/upgrade

Deterministic codemod CLI for upgrading the MongoDB Node.js driver. Detects your current version from `package.json`, plans a staged multi-hop upgrade path, applies mechanical transforms automatically, inserts `TODO` comments for issues that require human judgment, and runs preflight environment checks.

No LLM. No network calls (beyond `npm install`). Every transform is tested against input/output fixtures.

## Install

```bash
npm install -D @pavel-safronov/upgrade
# or run without installing:
npx @pavel-safronov/upgrade
```

## Usage

```bash
# Run from your project root (auto-detects mongodb version):
npx @pavel-safronov/upgrade

# Flags:
npx @pavel-safronov/upgrade --dry-run              # show what would change, write nothing
npx @pavel-safronov/upgrade --list                 # list all registered codemods
npx @pavel-safronov/upgrade --only stream-transform  # run one codemod by ID
npx @pavel-safronov/upgrade --from 6 --to 7        # override version detection
npx @pavel-safronov/upgrade /path/to/project       # specify project path explicitly
```

After a real run, `upgrade-report.json` is written to the project root with a machine-readable summary.

## v4 → v5 codemod catalog

| ID | Kind | Description |
| --- | --- | --- |
| `objectid-rename` | mechanical | `ObjectID` → `ObjectId` everywhere (import, type, and value sites) |
| `remove-v4-options` | mechanical | Removes `slaveOk`, `promiseLibrary`, `keepGoing` from any options object |
| `cursor-count` | semantic | `cursor.count()` removed in v5 — use `countDocuments()` or `estimatedDocumentCount()` |
| `legacy-collection-methods` | semantic | `collection.insert()`, `.update()`, `.remove()` — removed in v5 |
| `mapreduece-removed` | semantic | `collection.mapReduce()` — removed in v5 |
| `callback-api` | semantic | Any known MongoDB method called with a callback as the last argument |
| `node-version-v4to5` | env | Updates `engines.node` to `>=16.0.0` if needed |
| `mongodb-dep-bump-v5` | env | Bumps `mongodb` dependency to `^5.0.0` |

---

## v5 → v6 codemod catalog

| ID | Kind | Description |
| --- | --- | --- |
| `remove-connection-options-v6` | mechanical | Removes `sslCA`, `sslCRL`, `sslCert`, `sslKey`, `sslPass`, `sslValidate`, `tlsCertificateFile`, `keepAlive`, `keepAliveInitialDelay` from option objects |
| `bulk-result-props` | mechanical | Replaces `result.nInserted` / `.nUpserted` / `.nMatched` / `.nModified` / `.nRemoved` with `undefined` + TODO comment |
| `db-adduser-removed` | semantic | `db.addUser()` — removed in v6 |
| `collection-stats-removed` | semantic | `collection.stats()` — removed in v6 |
| `findoneand-metadata` | semantic | `findOneAndUpdate/Replace/Delete` without `includeResultMetadata: true` (return type changed) |
| `withtransaction-return` | semantic | Uses of the return value of `session.withTransaction()` (always `void` in v6) |
| `write-concern-options` | semantic | Top-level `j`, `w`, `wtimeout` options — move into `writeConcern: { j, w, wtimeout }` |
| `bool-coerce` | mechanical | Numeric booleans (`tls: 1` → `tls: true`) — coercion removed in v6 |
| `node-version-v5to6` | env | Updates `engines.node` to `>=16.20.1` if needed |
| `mongodb-dep-bump-v6` | env | Bumps `mongodb` dependency to `^6.0.0` |

---

## v6 → v7 codemod catalog

Mechanical transforms are applied automatically. Semantic transforms insert `// TODO(mongodb-upgrade): ...` comments for human review. Environmental checks update `package.json`.

| ID | Kind | Description |
| --- | --- | --- |
| `stream-transform` | mechanical | `cursor.stream({ transform: fn })` → `cursor.stream().map(fn)` |
| `pool-retry-label` | mechanical | Fixes typo `PoolRequstedRetry` → `PoolRequestedRetry` |
| `remove-beta-namespace` | mechanical | `import ... from 'mongodb/beta'` → `import ... from 'mongodb'` |
| `remove-client-options` | mechanical | Removes `useNewUrlParser`, `useUnifiedTopology`, `noResponse`, `retryWrites` from option objects |
| `remove-deprecated-types` | mechanical | Strips removed type imports: `CloseOptions`, `CancellationToken`, `Transaction`, `ResumeOptions`, `ServerCapabilities`, `ClientMetadataOptions`, `FindOneOptions` |
| `remove-gridfs-deprecated` | mechanical | Removes `contentType` and `aliases` from GridFS write stream options |
| `find-one-options` | mechanical | Removes `batchSize`, `noCursorTimeout` from `FindOneOptions` usage |
| `find-options-generic` | mechanical | `FindOptions<T>` → `FindOptions` (removes the type parameter) |
| `remove-property-access` | mechanical | `ReadPreference.minWireVersion` and `session.transaction` → `undefined` + TODO comment |
| `aws-explicit-credentials` | semantic | MONGODB-AWS URIs with embedded `user:pass@` credentials |
| `mongodb-cr-auth` | semantic | `authMechanism: 'MONGODB-CR'` usage |
| `client-metadata-props` | semantic | Access to `additionalDriverInfo`, `extendedMetadata` on client options |
| `cursor-implicit-batch-size` | semantic | `batchSize: 1000` (may have been compensating for the removed default) |
| `timeout-options` | semantic | `socketTimeoutMS`, `waitQueueTimeoutMS` deprecated in v6.11 — use `timeoutMS` |
| `node-version` | env | Updates `engines.node` to `>=20.19.0` if needed |
| `mongodb-dep-bump` | env | Bumps `mongodb` dependency to `^7.0.0` |
| `bson-dep-bump` | env | Bumps `bson` to `^7.0.0` if present |
| `peer-dep-kerberos` | env | Bumps `kerberos` to `^7.0.0` if present |
| `peer-dep-zstd` | env | Bumps `@mongodb-js/zstd` to `^7.0.0` if present |
| `peer-dep-encryption` | env | Bumps `mongodb-client-encryption` to `^7.0.0` if present |

## Library API

The CLI is also importable as a library (used by the MCP server):

```typescript
import { detect } from '@pavel-safronov/upgrade/detect';
import { buildPlan } from '@pavel-safronov/upgrade/plan';
import { getCatalog, getById } from '@pavel-safronov/upgrade/catalog/index';
import { runCodemods, runEnvChecks } from '@pavel-safronov/upgrade/runner';
import { buildReport, printReport } from '@pavel-safronov/upgrade/report';
```

## Development

```bash
cd packages/cli
npm install
npm run build    # tsup: ESM + CJS + .d.ts
npm test         # vitest: 97 tests across 16 test files
npm run dev      # watch mode
```

### Adding a new codemod

1. Create a directory under `src/catalog/v<N>/<your-id>/` (e.g. `src/catalog/v7/my-fix/`)
2. Add `__fixtures__/input.ts` and `__fixtures__/expected.ts`
3. Write `transform.test.ts` (fixture comparison + edge cases)
4. Write `transform.ts` (jscodeshift transform, `tsx` parser mode)
5. Register in the corresponding `src/catalog/v<N>/index.ts`; the root `src/catalog/index.ts` spreads all per-version catalogs automatically

### Test structure

- `src/*.test.ts` — unit tests for detect, plan, runner
- `src/catalog/v*/*/transform.test.ts` — per-codemod fixture tests
- `src/integration.test.ts` — end-to-end tests against `packages/test-app-v4`, `v5`, `v6`
