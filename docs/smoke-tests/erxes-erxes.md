# Smoke Test: erxes/erxes

**Date:** 2026-05-13
**Repo:** https://github.com/erxes/erxes
**Stars:** ★3978
**Commit:** HEAD (shallow clone)
**Approach:** Direct smoke test (v6 → v7)
**CLI version:** @pavel-safronov/upgrade@0.1.8

---

## Discovery

```
mongodb: ^6.18.0  (root package.json, dependencies)
engines.node: (none specified at root)
```

The root `package.json` has a direct `mongodb` dependency — the CLI detects v6 without needing to scan sub-packages. erxes is a large open-source CRM / business platform monorepo.

---

## Dry-run result

```
  ⚠ parse error, skipping packages/plugin-inbox-ui/src/components/messengerWidget.bundle.js:
    ...
  
[dry-run] MongoDB driver upgrade: 6.18.0 → 7.x

  ⚠ package.json — node-version [flagged]
      Updated engines.node to >=20.19.0
  ⚠ package.json — mongodb-dep-bump [flagged]
      Bumped mongodb to ^7.0.0 in dependencies

  0 transforms applied  0 flagged for review  2 env checks updated
```

**1 parse error:** `messengerWidget.bundle.js` — a bundled frontend artifact. Parser correctly skips bundled files it can't parse; this is expected and harmless. No valid upgrade targets live in bundle outputs.

---

## Classification

| Transform | File | Result | Notes |
|---|---|---|---|
| `node-version` env check | `package.json` | ✅ true positive | No `engines.node` specified at root. CLI adds `>=20.19.0` as a signal to set a minimum. Correct — v7 requires Node 20+. |
| `mongodb-dep-bump` | `package.json` | ✅ true positive | Bumps `^6.18.0` → `^7.0.0`. Correct. |

---

## Why zero code transforms?

erxes makes heavy use of **Mongoose** (`@erxes/api-utils/src/db/` uses `mongoose` models throughout). Direct `mongodb` driver calls are almost entirely absent from application code:

- `mongoose.connect()` is used for connections — not `MongoClient`
- All collections are accessed via Mongoose models (`Model.findOneAndUpdate`, etc.)
- Mongoose abstracts driver-level breaking changes from application code

Grepping the entire monorepo for v6 deprecated patterns (`cursor.count()`, `useNewUrlParser`, `useUnifiedTopology`, `ObjectID`, `sslCA`, `keepAlive`, deprecated `gridfs` options) returned **zero hits** in non-bundled source files.

**This is expected behaviour**, not a miss. Our codemods target the raw `mongodb` driver API, and Mongoose-heavy apps simply don't expose that surface directly.

---

## Missed items

| Pattern | Hits |
|---|---|
| `useNewUrlParser` / `useUnifiedTopology` | 0 in src/ |
| `ObjectID` | 0 in src/ (Mongoose uses its own ObjectId handling) |
| `sslCA` / `keepAlive` / `nInserted` | 0 |
| `cursor.count()` | 0 |
| Direct `MongoClient` usage | 0 |

---

## Verdict

**2 true positives (env checks). Zero false positives. Zero missed items.**

The zero-transform result is correct — erxes is Mongoose-driven, and Mongoose abstracts all the raw driver calls that our codemods target. The env checks (Node version floor + dep bump) are the meaningful output here: they tell the erxes maintainers what scaffolding they need before upgrading.

**The bundled JS parse error is a known limitation** (issue #4 was a separate bundle-hang bug, now fixed). Graceful skip of unparseable bundles is the correct behaviour.
