# Smoke Test: robvanderleek/create-issue-branch

**Date:** 2026-05-13
**Repo:** https://github.com/robvanderleek/create-issue-branch
**Stars:** ★348
**Commit:** HEAD (shallow clone)
**Approach:** Direct smoke test (v6 → v7)
**CLI version:** @pavel-safronov/upgrade@0.1.8

---

## Prior informal test

An earlier informal run of this repo found a **bundle hang bug** (issue #4, since fixed): the CLI would hang indefinitely when scanning large bundled JS files. That bug is resolved — the CLI now detects and skips bundle files gracefully. This report is the formal re-test after that fix.

---

## Discovery

```
mongodb: ^6.20.0  (dependencies)
engines.node: ">= 22.x"
```

`create-issue-branch` is a GitHub Action that creates a branch when an issue is assigned. It uses mongodb directly (not via Mongoose) for persisting action configuration and state.

The repo includes a compiled GitHub Action distribution at `action-dist/` — a large bundled JS file. This is intentionally excluded from analysis (it's a build artifact, not source).

---

## Dry-run result

```
[dry-run] MongoDB driver upgrade: 6.20.0 → 7.x

  ⚠ package.json — mongodb-dep-bump [flagged]
      Bumped mongodb to ^7.0.0 in dependencies

  0 transforms applied  0 flagged for review  1 env check updated
```

**No parse errors** on the source files. The `action-dist/` bundle was scanned but produced no upgrade-relevant hits (the CLI skips it or processes it without issue now that the hang bug is fixed).

**`node-version` is NOT flagged** — `engines.node: ">= 22.x"` has a minimum Node major of 22, which already exceeds the v7 driver requirement of >=20.19.0. The CLI correctly leaves it alone.

---

## Classification

| Transform | File | Result | Notes |
|---|---|---|---|
| `mongodb-dep-bump` | `package.json` | ✅ true positive | Bumps `^6.20.0` → `^7.0.0`. Correct. |
| `node-version` (skipped) | `package.json` | ✅ correct non-flag | `">= 22.x"` already satisfies >=20.19.0. No change needed. |

---

## Why zero code transforms?

The source code (`src/`) was grepped for all v6 deprecated patterns:

| Pattern | Hits |
|---|---|
| `cursor.count()` | 0 |
| `useNewUrlParser` / `useUnifiedTopology` | 0 |
| `ObjectID` | 0 |
| `sslCA` / `keepAlive` | 0 |
| `.stream({ transform` | 0 |
| `nInserted` / `nModified` / `nRemoved` | 0 |

The app uses standard CRUD operations (`findOne`, `updateOne`, `insertOne`) with no deprecated patterns. The codebase was already clean at the time of the v6 pinning.

---

## Verdict

**1 true positive (env check). Zero false positives. Zero missed items.**

The `node-version` non-flag is a notable correctness proof: repos that already pin to a high Node version should not be told to change their engines field. The CLI handles this correctly post-fix. 

The dep bump is the only real action needed here — the source code requires no changes.
