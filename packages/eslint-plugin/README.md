# @pavel-safronov/eslint-plugin-mongodb-upgrade

ESLint plugin for upgrading the MongoDB Node.js driver. Covers breaking changes across v4→v5→v6→v7 with auto-fix support where the change is mechanical.

## Install

```bash
npm install -D @pavel-safronov/eslint-plugin-mongodb-upgrade
```

## Setup

### ESLint v9 (flat config)

```js
// eslint.config.mjs
import mongodbUpgrade from '@pavel-safronov/eslint-plugin-mongodb-upgrade';

export default [
  {
    plugins: { 'mongodb-upgrade': mongodbUpgrade },
    rules: mongodbUpgrade.configs.recommended.rules,
  },
];
```

### ESLint v8 (legacy config)

```js
// .eslintrc.js
module.exports = {
  plugins: ['@pavel-safronov/mongodb-upgrade'],
  extends: ['plugin:@pavel-safronov/mongodb-upgrade/recommended'],
};
```

## Example

Given this file using mongodb@6 patterns:

```ts
import { MongoClient, ObjectID, FindOptions, CancellationToken } from 'mongodb';
//                    ^^^^^^^^                ^^^^^^^^^^^^^^^^^ no-deprecated-types (auto-fix: remove)
//                    ^^^^^^^^ no-objectid (auto-fix: rename to ObjectId)

const client = new MongoClient(uri, {
  useNewUrlParser: true,   // no-deprecated-client-options (auto-fix: remove)
  useUnifiedTopology: true,// no-deprecated-client-options (auto-fix: remove)
  j: true,                 // no-top-level-write-concern (warn: move to writeConcern: { j })
  tls: 1,                  // no-numeric-bool-options (auto-fix: → tls: true)
  socketTimeoutMS: 5000,   // no-legacy-timeout-options (warn: use timeoutMS)
});

const id = new ObjectID('abc123');
//             ^^^^^^^^ no-objectid (auto-fix: → ObjectId)

const opts: FindOptions<User> = { sort: { _id: 1 } };
//                     ^^^^^^ no-find-options-generic (auto-fix: remove type param)

const stream = cursor.stream({ transform: doc => ({ ...doc, _id: doc._id.toString() }) });
//                             ^^^^^^^^^ no-stream-transform (auto-fix: → cursor.stream().map(fn))

const n = await cursor.count();
//                     ^^^^^ no-cursor-count (warn: use countDocuments or estimatedDocumentCount)
```

After `eslint --fix`:

```ts
import { MongoClient, ObjectId } from 'mongodb';

const client = new MongoClient(uri, {
  // TODO: move j into writeConcern: { j: true }
  j: true,
  tls: true,
  // TODO: socketTimeoutMS deprecated — consider timeoutMS
  socketTimeoutMS: 5000,
});

const id = new ObjectId('abc123');

const opts: FindOptions = { sort: { _id: 1 } };

const stream = cursor.stream().map(doc => ({ ...doc, _id: doc._id.toString() }));

const n = await cursor.count(); // manual action required — see warning
```

Auto-fixable rules rewrite the code in place. Semantic warnings (no-top-level-write-concern, no-legacy-timeout-options, no-cursor-count) require a manual decision and are left as-is after `--fix`.

## Rule catalog

All rules are `warn` in the `recommended` config. Rules marked **✅** support `eslint --fix`.

### v5 rules (v4→v5 breaking changes)

| Rule | Fixable | Description |
| --- | --- | --- |
| `mongodb-upgrade/no-objectid` | ✅ | Rename `ObjectID` → `ObjectId` |
| `mongodb-upgrade/no-v4-options` | ✅ | Remove `slaveOk`, `promiseLibrary`, `keepGoing` |
| `mongodb-upgrade/no-cursor-count` | — | Warn on `cursor.count()` removed in v5 — use `countDocuments()` or `estimatedDocumentCount()` |

### v6 rules (v5→v6 breaking changes)

| Rule | Fixable | Description |
| --- | --- | --- |
| `mongodb-upgrade/no-v6-connection-options` | ✅ | Remove `ssl*`, `keepAlive*` options |
| `mongodb-upgrade/no-bulk-result-props` | ✅ | Rename `nInserted` → `insertedCount`, etc. |
| `mongodb-upgrade/no-top-level-write-concern` | — | Warn on top-level `j`, `w`, `wtimeout` — move into `writeConcern: { ... }` |
| `mongodb-upgrade/no-numeric-bool-options` | ✅ | Convert numeric booleans: `tls: 1` → `tls: true` (coercion removed in v6) |

### v7 rules (v6→v7 breaking changes)

| Rule | Fixable | Description |
| --- | --- | --- |
| `mongodb-upgrade/no-beta-namespace` | ✅ | `mongodb/beta` → `mongodb` |
| `mongodb-upgrade/no-pool-retry-label` | ✅ | Fix typo `PoolRequstedRetry` → `PoolRequestedRetry` |
| `mongodb-upgrade/no-deprecated-client-options` | ✅ | Remove `useNewUrlParser`, `useUnifiedTopology`, `noResponse`, `retryWrites` |
| `mongodb-upgrade/no-deprecated-types` | ✅ | Remove removed type imports (`CloseOptions`, `CancellationToken`, etc.) |
| `mongodb-upgrade/no-deprecated-gridfs-options` | ✅ | Remove `contentType`, `aliases` from GridFS write stream options |
| `mongodb-upgrade/no-find-one-options` | ✅ | Remove `batchSize`, `noCursorTimeout` from `FindOneOptions` |
| `mongodb-upgrade/no-find-options-generic` | ✅ | Remove type parameter from `FindOptions<T>` |
| `mongodb-upgrade/no-stream-transform` | ✅ | `cursor.stream({ transform: fn })` → `cursor.stream().map(fn)` |
| `mongodb-upgrade/no-deprecated-property-access` | — | Warn on `ReadPreference.minWireVersion`, `session.transaction` |
| `mongodb-upgrade/no-legacy-timeout-options` | — | Warn on `socketTimeoutMS`, `waitQueueTimeoutMS` deprecated in v6.11 — use `timeoutMS` |

## Notes

- All rules guard on a mongodb import being present in the file, so they won't fire in unrelated code.
- Rules that remove object properties (e.g. `no-deprecated-client-options`) may leave extra whitespace after `--fix`. Run Prettier or your formatter to clean up.
- `no-find-options-generic` only fires when using `@typescript-eslint/parser` (requires TypeScript AST).
- `no-numeric-bool-options` targets specific known boolean option names (`tls`, `ssl`, `directConnection`, etc.) — it won't touch arbitrary numeric values in unrelated objects.
