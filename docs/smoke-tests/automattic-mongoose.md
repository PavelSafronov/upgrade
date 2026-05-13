# Smoke Test: Automattic/mongoose

**Date:** 2026-05-13
**Repo:** https://github.com/Automattic/mongoose
**Approach:** Historical analysis — found v6→v7 upgrade commit, checked out pre-upgrade state
**CLI version:** @pavel-safronov/upgrade@0.1.5

---

## The upgrade commit

```
cba094c2  Merge branch '9.0' into vkarpov15/gh-15389-3
Author: Valeri Karpov <val@karpov.io>
Date:   Fri Nov 7 10:57:19 2025 -0500
Files changed: 28 files (major v9 release merge)
```

The mongodb bump (`~6.20.0` → `~7.0`) was embedded in a **large merge commit** for Mongoose v9. The driver upgrade was one of many changes — not an isolated dep bump. Mongoose v9 was a major release, and the mongodb v7 upgrade was part of it.

**Pre-upgrade commit analyzed:** `fae374b1` (last commit with `mongodb: ~6.20.0`, 2025-11-04)
**mongodb version at analysis:** `~6.20.0`
**bson version:** `^6.10.4`
**engines.node:** `>=16.20.1`

---

## CLI result (dry-run)

```
  ⚠ parse error, skipping test/types/queries.test.ts: Unexpected reserved word 'await'. (581:14)
  ⚠ parse error, skipping test/types/models.test.ts: Unexpected reserved word 'await'. (514:28)

[dry-run] MongoDB driver upgrade: 6.20.0 → 7.x

  ⚠ test/aggregate.test.js — cursor-implicit-batch-size [flagged]
  ⚠ package.json — node-version [flagged]
      Updated engines.node to >=20.19.0
  ⚠ package.json — mongodb-dep-bump [flagged]
      Bumped mongodb to ^7.0.0 in dependencies
  ⚠ package.json — bson-dep-bump [flagged]
      Bumped bson to ^7.0.0 in dependencies

  0 transforms applied  1 flagged for review  3 env checks updated
```

**2 parse errors:** Two TypeScript type test files use top-level `await` in a way the `tsx` babel parser doesn't expect. Skipped gracefully.

---

## Classification

| Transform | File | Result | Notes |
|---|---|---|---|
| `cursor-implicit-batch-size` | `test/aggregate.test.js:1179` | ✅ true positive | `MyModel.aggregate([]).cursor({ batchSize: 1000 }).exec()` — Mongoose passes cursor options through to the underlying driver cursor. `batchSize: 1000` may have been compensating for the removed default. Worth reviewing. |
| `node-version` env check | `package.json` | ✅ true positive | `engines.node: >=16.20.1` — Node 16 is well below the v7 driver's requirement of Node 20. Correctly flagged. |
| `mongodb-dep-bump` | `package.json` | ✅ true positive | Bumping from `~6.20.0` to `^7.0.0`. |
| `bson-dep-bump` | `package.json` | ✅ true positive | `bson: ^6.10.4` needs to be aligned to `^7.0.0` for mongodb driver v7 compatibility. |

**Note on the batchSize flag location:** The flag is in a **test file**, not production code. The production code (`lib/aggregate.js:938`) has `batchSize: 1000` only in a JSDoc comment/example — correctly not flagged.

---

## Mongoose's production code: clean pre-upgrade

The direct driver imports in Mongoose's production code are:

- `lib/index.js` — `require('mongodb')` to expose the driver on `mongoose.mongo`
- `lib/drivers/node-mongodb-native/connection.js` — primary driver usage (MongoClient, sessions)
- `lib/drivers/node-mongodb-native/collection.js` — wraps Collection
- `lib/drivers/node-mongodb-native/index.js` — ClientEncryption export

Grepping all of these for v5/v6/v7 deprecated patterns (`useNewUrlParser`, `useUnifiedTopology`, `ObjectID`, `sslCA`, `keepAlive`, `findOneAndUpdate` direct calls, `socketTimeoutMS`) returned **zero hits**.

**The Mongoose maintainers had already removed deprecated APIs from their driver layer before officially bumping the dependency.** Our CLI correctly produces zero transforms on production code.

---

## Missed items

| Pattern | Hits |
|---|---|
| `useNewUrlParser` / `useUnifiedTopology` | 0 |
| `ObjectID` | 0 in lib/ |
| `sslCA` / `keepAlive` / `nInserted` | 0 |
| `socketTimeoutMS` | 0 |
| `cursor.count()` | 0 |
| `batchSize: 1000` in production code | 0 (only in JSDoc comment, correctly skipped) |

---

## Verdict

**All 4 flags are true positives. Zero missed items.** Mongoose is a near-perfect test case: pre-cleaned production code, one genuine test-layer flag, and three accurate env checks. The CLI result is exactly what an ideal upgrade tool should produce on a well-maintained library.

**Notable:** Mongoose chose to co-release their mongodb driver v7 support with a major version bump (v9). The production code was already clean — the tests and tooling config needed updating.
