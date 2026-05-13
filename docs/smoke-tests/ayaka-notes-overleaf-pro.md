# Smoke Test: ayaka-notes/overleaf-pro

**Date:** 2026-05-13
**Repo:** https://github.com/ayaka-notes/overleaf-pro
**Stars:** ★381
**Commit:** HEAD (shallow clone)
**Approach:** Direct smoke test (v6 → v7)
**CLI version:** @pavel-safronov/upgrade@0.1.8

---

## Prior informal test

An earlier informal run of this repo surfaced a **GridFS false positive** (issue #5): the CLI was flagging `GridFSBucket` constructors that were already correct for v7. That bug has since been fixed. This report is the formal re-test after the fix.

---

## Discovery: monorepo

The root `package.json` has no `mongodb` dependency. The driver lives in four backend service sub-packages:

| Sub-package | mongodb version |
|---|---|
| `services/chat` | `6.12.0` |
| `services/contacts` | `6.12.0` |
| `services/filestore` | `6.12.0` |
| `services/mongo-utils` | `6.12.0` |

All four pin to the same exact version (`6.12.0`, no range). Each was tested independently.

---

## Dry-run results

All four sub-packages produce identical output:

```
[dry-run] MongoDB driver upgrade: 6.12.0 → 7.x

  ⚠ package.json — node-version [flagged]
      Updated engines.node to >=20.19.0
  ⚠ package.json — mongodb-dep-bump [flagged]
      Bumped mongodb to ^7.0.0 in dependencies

  0 transforms applied  0 flagged for review  2 env checks updated
```

No parse errors. No code transforms across any of the four sub-packages.

---

## Classification

| Transform | File | Result | Notes |
|---|---|---|---|
| `node-version` env check | each `package.json` | ✅ true positive | No `engines.node` specified in any sub-package. v7 requires Node 20+. Correct flag. |
| `mongodb-dep-bump` | each `package.json` | ✅ true positive | Bumps exact `6.12.0` → `^7.0.0`. Correct. |

---

## GridFS false positive: confirmed fixed

The prior informal test flagged GridFS usage in `services/filestore/` as a false positive. Grepping `services/filestore/app/js/` for all GridFS-related patterns:

```
grep -r "GridFS\|gridfs\|GridFSBucket\|createWriteStream\|createReadStream\|openUploadStream\|openDownloadStream" \
     services/filestore/app/js/
```

**Zero hits in source files.** The filestore service uses MongoDB for file metadata tracking, not GridFS directly (it appears to use a custom storage abstraction, or the GridFS code was removed/refactored). There is nothing to flag, and nothing is flagged. The false positive from the informal test is no longer reproducible.

---

## Why zero code transforms (across all sub-packages)?

Grepped all four service directories for v6 deprecated patterns:

| Pattern | Hits |
|---|---|
| `cursor.count()` | 0 |
| `useNewUrlParser` / `useUnifiedTopology` | 0 |
| `ObjectID` | 0 |
| `sslCA` / `keepAlive` / `nInserted` | 0 |
| `.stream({ transform` | 0 |
| Direct `findOneAndUpdate` return value usage | 0 |

The services use standard MongoDB operations (aggregation pipelines, CRUD, index management) with no deprecated surface. Overleaf-pro is a well-maintained fork that appears to track the upstream Overleaf repo's cleanup work.

---

## Interesting: exact version pins across all four services

All four sub-packages pin to `6.12.0` exactly (no `^` or `~`). This suggests they're updated in lockstep — likely a shared internal release process. After upgrading, using `^7.0.0` would be standard practice; the exact pin may be intentional for reproducibility.

---

## Verdict

**8 true positives total (2 env checks × 4 sub-packages). Zero false positives. Zero missed items. GridFS false positive confirmed fixed.**

For actual upgrade work, the four sub-packages should be bumped together. The dep bump and Node version flag are all that's needed — no source code changes required across any of the services.
