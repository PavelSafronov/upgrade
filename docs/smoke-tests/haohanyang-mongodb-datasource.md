# Smoke Test: haohanyang/mongodb-datasource

**Date:** 2026-05-13
**Repo:** https://github.com/haohanyang/mongodb-datasource
**Stars:** ★154
**Commit:** HEAD (shallow clone)
**Approach:** Direct smoke test (v6 → v7)
**CLI version:** @pavel-safronov/upgrade@0.1.8

---

## Discovery

```
package.json:
  devDependencies:
    mongodb: ^6.9.0
    bson: ^6.8.0
```

`mongodb-datasource` is a Grafana datasource plugin for MongoDB. The driver is a **dev dependency** — used for tests and local development, not shipped as a production runtime dependency. There is no `engines.node` field.

This is an unusual dep placement (driver in `devDependencies`) — most apps put it in `dependencies`. The CLI handles this correctly.

---

## Dry-run result

```
[dry-run] MongoDB driver upgrade: 6.9.0 → 7.x

  ⚠ package.json — mongodb-dep-bump [flagged]
      Bumped mongodb to ^7.0.0 in devDependencies
  ⚠ package.json — bson-dep-bump [flagged]
      Bumped bson to ^7.0.0 in devDependencies

  0 transforms applied  0 flagged for review  2 env checks updated
```

No parse errors. No code transforms. **Both bumps correctly target `devDependencies`** — the CLI detects the placement and edits the right block.

`node-version` is **not flagged** — no `engines.node` in `package.json` and the project is a Grafana plugin (the Node version constraint is Grafana's concern, not the plugin's).

---

## Classification

| Transform | File | Result | Notes |
|---|---|---|---|
| `mongodb-dep-bump` | `package.json` | ✅ true positive | Bumps `^6.9.0` → `^7.0.0` in devDependencies. Correct placement. |
| `bson-dep-bump` | `package.json` | ✅ true positive | Bumps `^6.8.0` → `^7.0.0` in devDependencies. Correct — bson v6 and mongodb v7 are incompatible. |

---

## Why zero code transforms?

The plugin source (`src/`) queries MongoDB via a Go backend with a thin TypeScript frontend. The TypeScript side uses the driver for connection testing and schema introspection. Grepping for deprecated patterns:

| Pattern | Hits |
|---|---|
| `cursor.count()` | 0 |
| `useNewUrlParser` / `useUnifiedTopology` | 0 |
| `ObjectID` | 0 |
| `sslCA` / `keepAlive` / `nInserted` | 0 |
| `.stream({ transform` | 0 |

Clean codebase. No deprecated patterns in the TypeScript driver usage.

---

## Interesting: devDependency placement is correct

The driver is in `devDependencies` because this is a Grafana backend plugin — the Go backend handles actual MongoDB connections at runtime; the TypeScript side uses the driver only in tests. The CLI correctly identifies which block to edit:

- Detected version from `devDependencies.mongodb`
- Edits `devDependencies` (not `dependencies`) when writing the bumped version
- Same for `bson`

This demonstrates that the dep placement detection works correctly for non-standard configurations.

---

## Verdict

**2 true positives (env checks). Zero false positives. Zero missed items.**

The notable finding is that the CLI correctly handles `devDependencies`-only driver configurations — including bumping both `mongodb` and `bson` in the right block. The zero-transform result is correct for this clean codebase.
