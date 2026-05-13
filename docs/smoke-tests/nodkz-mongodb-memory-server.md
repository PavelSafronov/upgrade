# Smoke Test: nodkz/mongodb-memory-server

**Date:** 2026-05-13
**Repo:** https://github.com/nodkz/mongodb-memory-server
**Approach:** Historical analysis — found v6→v7 upgrade commit in `mongodb-memory-server-core`
**CLI version:** @pavel-safronov/upgrade@0.1.5

---

## Discovery: monorepo, target the core package

The root `package.json` has no `mongodb` dependency. The relevant sub-packages:

| Package | mongodb version (current) |
|---|---|
| `packages/mongodb-memory-server-core` | `^7.2.0` |
| `packages/mongodb-memory-server` | none (uses core as dep) |
| `packages/mongodb-memory-server-global` | none |

Run the CLI targeting `packages/mongodb-memory-server-core` directly.

---

## The upgrade commit

```
8430483d  deps(mongodb): upgrade to 7.0.0
Author: hasezoey <hasezoey@gmail.com>
Date:   Wed Dec 3 15:42:53 2025 +0100
Files changed: package.json, docs/guides/migration/migrate11.md, yarn.lock
```

A hand-authored upgrade commit (not Dependabot). Changed: `^6.9.0` → `^7.0.0` in core's package.json, yarn.lock, and added a migration guide section. **No source code changes.**

This upgrade was part of the v11 release (the next commit after it is `release: v11.0.0-beta.1`).

**Pre-upgrade commit analyzed:** `8430483d^` (parent of the upgrade commit, 2025-12-03)
**mongodb version at analysis:** `^6.9.0`

---

## CLI result (dry-run)

```
[dry-run] MongoDB driver upgrade: 6.9.0 → 7.x

  ⚠ package.json — mongodb-dep-bump [flagged]
      Bumped mongodb to ^7.0.0 in dependencies

  0 transforms applied  1 env checks updated
```

**Result matches the actual upgrade exactly:** dep bump only, no source changes.

---

## Why zero source transforms

`mongodb-memory-server-core` uses the MongoDB driver for one purpose: to create `MongoClient` connections during test setup/teardown. It never touches user-facing APIs like cursors, streams, GridFS, result handling, or option objects that changed between v6 and v7. The driver usage is almost entirely `new MongoClient(uri)` + `client.connect()` + `client.close()`.

Grepping `packages/mongodb-memory-server-core/src` for all v6→v7 breaking change patterns (`useNewUrlParser`, `useUnifiedTopology`, `socketTimeoutMS`, `batchSize: 1000`, `findOneAndUpdate`, `.stream({ transform`, etc.) returned **zero hits**.

---

## Missed items

Zero. The grep confirmed no patterns exist in the source.

---

## Verdict

**Correct result. 0 transforms, 1 accurate dep bump.** MMS is the leanest driver consumer in the test corpus — minimal API surface means minimal upgrade friction. Not a useful stress-test for codemods, but useful as a **regression check**: the CLI should always produce exactly this output on MMS.

---

## Notes

- **Monorepo pattern** (same as apostrophecms): the CLI needs to be pointed at the sub-package, not the repo root
- MMS's migration guide (`docs/guides/migration/migrate11.md`) documents the mongodb v7 change explicitly for users — worth checking against our own documentation for completeness
- Future: check the migration guide for any breaking changes they document that we don't have codemods for
