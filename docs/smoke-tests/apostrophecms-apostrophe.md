# Smoke Test: apostrophecms/apostrophe

**Date:** 2026-05-13
**Repo:** https://github.com/apostrophecms/apostrophe
**Commit:** HEAD (shallow clone)
**Approach:** Direct smoke test (v6 → v7)
**CLI version:** @pavel-safronov/upgrade@0.1.5

---

## Discovery: monorepo, no root mongodb dep

The root `package.json` has no `mongodb` dependency. Running `upgrade` against the repo root fails:

```
Error: Could not detect mongodb version in package.json
```

The two sub-packages that pin to mongodb v6 are:

| Sub-package | mongodb version |
|---|---|
| `packages/emulate-mongo-3-driver` | `^6.8.0` |
| `packages/mongodb-snapshot` | `^6.12.0` |

The main apostrophe application code has **no direct mongodb imports** anywhere in `lib/` or `modules/`. The driver is fully abstracted — apostrophe consumers never call the driver directly.

---

## emulate-mongo-3-driver (^6.8.0)

This package is a compatibility shim that wraps `mongodb-legacy` to emulate the MongoDB v3 API on top of v6. It patches `MongoClient`, `Db`, `Collection`, and `FindCursor`.

**Dry-run result:**

```
0 transforms applied  2 env checks updated
  ⚠ package.json — node-version [flagged]
  ⚠ package.json — mongodb-dep-bump [flagged]
```

**Interesting observation:** The constructor already manually strips `useNewUrlParser`, `useUnifiedTopology`, `autoReconnect`, `reconnectTries`, and `reconnectInterval` — the exact options our `no-deprecated-client-options` codemod targets. The shim handles this explicitly because it needs to accept the v3 API and pass only valid v6 options to `super()`. Our codemod would correctly produce zero hits on this already-handled code.

## mongodb-snapshot (^6.12.0)

Utility for snapshotting and restoring MongoDB databases. Source code at `bin/dump.js`, `bin/restore.js`, `index.js`.

**Dry-run result:**

```
0 transforms applied  3 env checks updated
  ⚠ package.json — node-version [flagged]
  ⚠ package.json — mongodb-dep-bump [flagged]
  ⚠ package.json — bson-dep-bump [flagged]
```

---

## Missed items

Grepped all `.{js,ts,mjs,cjs}` files across the entire repo for v4→v7 patterns (`ObjectID`, `cursor.count()`, `sslCA`, `nInserted`, `useNewUrlParser`, `stream({ transform`, `socketTimeoutMS`, etc.): **zero hits**.

---

## Verdict

**Not a useful smoke test target.** Apostrophe is an excellent MongoDB consumer in production, but the driver is completely hidden behind an internal abstraction layer. Our codemods target direct driver API usage, which doesn't exist in apostrophe's codebase.

---

## Findings / Action items

| Finding | Impact | Recommendation |
|---|---|---|
| CLI errors on monorepo roots with no root mongodb dep | UX — confusing error message | Improve the error message: suggest scanning sub-packages |
| `emulate-mongo-3-driver` already handles deprecated options manually | Correctness — no false positives | No action needed; import guard correctly suppresses codemods |

---

## Notes

- Target sub-packages directly when running against this repo: `upgrade packages/emulate-mongo-3-driver` or `upgrade packages/mongodb-snapshot`
- For future runs, the interesting package is `emulate-mongo-3-driver` when they decide to drop the v3 emulation layer and move to direct v7 usage
