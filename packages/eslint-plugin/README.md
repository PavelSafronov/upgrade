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

## Rule catalog

All rules are `warn` in the `recommended` config. Rules marked **fixable** support `eslint --fix`.

### v5 rules (ObjectID removal, v4 deprecated options)

| Rule | Fixable | Description |
| --- | --- | --- |
| `mongodb-upgrade/no-objectid` | ✅ | Rename `ObjectID` → `ObjectId` |
| `mongodb-upgrade/no-v4-options` | ✅ | Remove `slaveOk`, `promiseLibrary`, `keepGoing` |

### v6 rules (connection options, BulkWriteResult)

| Rule | Fixable | Description |
| --- | --- | --- |
| `mongodb-upgrade/no-v6-connection-options` | ✅ | Remove `ssl*`, `keepAlive*` options |
| `mongodb-upgrade/no-bulk-result-props` | ✅ | Rename `nInserted` → `insertedCount`, etc. |

### v7 rules (13 changes)

| Rule | Fixable | Description |
| --- | --- | --- |
| `mongodb-upgrade/no-beta-namespace` | ✅ | `mongodb/beta` → `mongodb` |
| `mongodb-upgrade/no-pool-retry-label` | ✅ | Fix typo `PoolRequstedRetry` → `PoolRequestedRetry` |
| `mongodb-upgrade/no-deprecated-client-options` | ✅ | Remove `useNewUrlParser`, `useUnifiedTopology`, `noResponse`, `retryWrites` |
| `mongodb-upgrade/no-deprecated-types` | ✅ | Remove removed type imports (`CloseOptions`, `CancellationToken`, etc.) |
| `mongodb-upgrade/no-deprecated-gridfs-options` | ✅ | Remove `contentType`, `aliases` from GridFS options |
| `mongodb-upgrade/no-find-one-options` | ✅ | Remove `batchSize`, `limit`, `noCursorTimeout` from `FindOneOptions` |
| `mongodb-upgrade/no-find-options-generic` | ✅ | Remove type parameter from `FindOptions<T>` |
| `mongodb-upgrade/no-stream-transform` | ✅ | `cursor.stream({ transform: fn })` → `cursor.stream().map(fn)` |
| `mongodb-upgrade/no-deprecated-property-access` | — | Warn on `ReadPreference.minWireVersion`, `session.transaction` |

## Notes

- All rules guard on a mongodb import being present in the file, so they won't fire in unrelated code.
- Rules that remove object properties (e.g. `no-deprecated-client-options`) may leave extra whitespace after `--fix`. Run Prettier or your formatter to clean up.
- `no-find-options-generic` only fires when using `@typescript-eslint/parser` (requires TypeScript AST).
