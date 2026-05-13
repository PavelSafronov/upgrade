# Smoke Test: rubynor/bigfive-web

**Date:** 2026-05-13
**Repo:** https://github.com/rubynor/bigfive-web
**Stars:** ★867
**Commit:** HEAD (shallow clone)
**Approach:** Direct smoke test (v6 → v7)
**CLI version:** @pavel-safronov/upgrade@0.1.8

---

## Discovery

`bigfive-web` is a monorepo. The root `package.json` has no `mongodb` dependency — the driver lives in the `web/` sub-package (a Next.js app).

```
web/package.json:
  mongodb: 6.5.0  (dependencies, exact pin — no caret/tilde)
  engines: (none specified)
```

Running against `web/` directly:

```bash
node packages/cli/dist/index.js web/
```

---

## Dry-run result

```
[dry-run] MongoDB driver upgrade: 6.5.0 → 7.x

  ⚠ web/package.json — node-version [flagged]
      Updated engines.node to >=20.19.0
  ⚠ web/package.json — mongodb-dep-bump [flagged]
      Bumped mongodb to ^7.0.0 in dependencies

  0 transforms applied  0 flagged for review  2 env checks updated
```

No parse errors. No code transforms.

---

## Classification

| Transform | File | Result | Notes |
|---|---|---|---|
| `node-version` env check | `web/package.json` | ✅ true positive | No `engines.node` specified. CLI adds `>=20.19.0`. Correct — no engines field means the minimum is unknown, flagging it prompts the maintainer to confirm their Node requirement. |
| `mongodb-dep-bump` | `web/package.json` | ✅ true positive | Bumps exact `6.5.0` → `^7.0.0`. Correct. |

---

## Why zero code transforms?

`bigfive-web` uses MongoDB for a simple personality test scoring database. The driver usage in `web/src/` is minimal and idiomatic:

| Pattern | Hits |
|---|---|
| `cursor.count()` | 0 |
| `useNewUrlParser` / `useUnifiedTopology` | 0 |
| `ObjectID` | 0 |
| `sslCA` / `keepAlive` / `nInserted` | 0 |
| `.stream({ transform` | 0 |
| Direct `gridfs` usage | 0 |

The app uses `MongoClient`, `db.collection()`, `findOne()`, `insertOne()`, and `deleteMany()` — all stable APIs that carry forward unchanged from v6 to v7.

---

## Verdict

**2 true positives (env checks). Zero false positives. Zero missed items.**

Straightforward v6 app with no deprecated APIs in use. Dep bump + Node version flag are all that's needed. The exact-pin version (`6.5.0` without caret) is worth noting — the maintainer may want to use `^7.0.0` to get patch updates.
