# Smoke Test: loopbackio/loopback-connector-mongodb

**Date:** 2026-05-13
**Repo:** https://github.com/loopbackio/loopback-connector-mongodb
**Commit:** HEAD (sha shallow clone)
**Approach:** Direct smoke test (v5 → v7, two-hop upgrade)
**CLI version:** @pavel-safronov/upgrade@0.1.5 (with fixes from this session)

---

## Discovery

```
mongodb: ^5.9.2  (in dependencies)
bson: ^7.2.0     (in dependencies — already at v7!)
engines.node: "20 || 22 || 24"
```

LoopBack is the only repo in the corpus pinned to mongodb v5 — it exercises the v5→v6 and v6→v7 codemod paths.

**Interesting pre-condition:** bson was already at `^7.2.0` despite using mongodb v5. The CLI previously downgraded this to `^7.0.0` (a bug fixed in this session — see [env check false-action bug](#bugs-found)).

---

## Dry-run result (post-fix)

```
[dry-run] MongoDB driver upgrade: 5.9.2 → 7.x

  ⚠ lib/mongodb.js — findoneand-metadata [flagged]
  ⚠ package.json — mongodb-dep-bump-v6 [flagged]
      Bumped mongodb to ^6.0.0 in dependencies
  ⚠ package.json — mongodb-dep-bump [flagged]
      Bumped mongodb to ^7.0.0 in dependencies

  0 transforms applied  1 flagged for review  2 env checks updated
```

Notable: `bson-dep-bump` is **not** flagged (bson already at `^7.2.0`, correctly skipped after bug fix). `node-version` is **not** flagged (`"20 || 22 || 24"` has min major 20, correctly skipped after bug fix).

---

## Apply diff

```diff
--- a/lib/mongodb.js
+++ b/lib/mongodb.js
@@ -1670,6 +1670,7 @@
   const projection = fieldsArrayToObj(filter.fields);
 
+  // TODO(mongodb-upgrade): findOneAndUpdate() now returns the document directly (not wrapped in ModifyResult) unless you pass { includeResultMetadata: true }. Verify your code handles the new return type.
   const callbackFindOneAndUpdate = util.callbackify(() => this.collection(modelName).findOneAndUpdate(

--- a/package.json
+++ b/package.json
@@
-    "mongodb": "^5.9.2",
+    "mongodb": "^7.0.0",
```

bson pinned at `^7.2.0`, engines.node left as `"20 || 22 || 24"` — both correct.

---

## Classification

| Transform | File | Result | Notes |
|---|---|---|---|
| `findoneand-metadata` | `lib/mongodb.js:1674` | ✅ true positive | Direct `.findOneAndUpdate()` call on a MongoDB collection in `findOrCreate()`. Return value is wrapped in `util.callbackify()` — the caller should verify it handles the new direct-document return type. |

**Other `findOneAndUpdate` references** (lines 1002, 1926, 2050): These are string arguments to `this.execute(modelName, 'findOneAndUpdate', ...)`, loopback's internal dispatch mechanism. They route to the driver internally and are **not** direct driver calls. The CLI correctly skips them. Whether the result handling in those code paths is affected requires inspecting the execute wrapper — flagged as **uncertain** for manual review.

---

## Missed items

| Pattern | Hits |
|---|---|
| `useNewUrlParser` / `useUnifiedTopology` | 0 |
| `ObjectID` | In test files only — via `ds.ObjectID` (connector's own export, not direct driver import) — **not a miss** |
| `sslCA` / `keepAlive` / `nInserted` | 0 |
| `socketTimeoutMS` | 0 |
| Direct `.findOneAndUpdate()` calls | 1 (line 1674, correctly flagged) |

---

## Bugs found during this analysis

### Bug 3 — `bson-dep-bump` downgrades an already-higher bson version

`bson` was at `^7.2.0` (already v7) but the env check overwrote it to `^7.0.0` — a downgrade.

**Fix:** Added `semver.satisfies(minVersion, target)` guard to `peerDepBump()` in `env/v7.ts`. If the current version already satisfies the target constraint, skip.

### Bug 4 — `node-version` rewrites a perfectly valid engines field

`"engines": { "node": "20 || 22 || 24" }` was overwritten to `">=20.19.0"`. The original is semantically different (explicit LTS list vs. open range).

**Fix:** Changed `nodeVersionCheck` to check `semver.major(minVersion) >= 20` rather than whether the version satisfies `>=20.19.0`. If the project's minimum Node major is already >=20, leave their engines field alone.

---

## Verdict

**1 true positive, 0 mechanical transforms needed, 2 correct env checks.** The CLI correctly identifies the `findOneAndUpdate` return-type change and handles the v5→v7 two-hop dep upgrade. After bug fixes, bson and engines.node are correctly left untouched.

**Uncertainty:** The indirect `this.execute(modelName, 'findOneAndUpdate', ...)` call sites (lines 1002, 1926, 2050) may also be affected by the return-type change, but they're not direct driver calls and can't be flagged without deeper semantic analysis.
