# Initiatives Tracker

Living document. Update as work progresses.

---

## 🔲 Todos (immediate)

- [x] ~~Publish v0.1.8 with the two bug fixes committed since v0.1.7~~ ✅ done
- [x] ~~Implement v4→v5 codemods~~ ✅ done — 8 codemods, 97 tests passing
- [x] ~~Implement v5→v6 codemods~~ ✅ done — 10 codemods, wired into catalog
- [x] ~~**Missed pattern mining**~~ ✅ done — see findings below
- [x] ~~**ESLint plugin**~~ ✅ done — 17 rules (v4→v5→v6→v7), all tests passing, published as v0.1.8
- [x] ~~**Landscape summary report**~~ ✅ done — `tools/landscape.ts`, run via `npm run landscape`
- [x] ~~**CI regression guard**~~ ✅ done — corpus snapshot tests in `packages/cli/src/corpus.test.ts`; runs on every push via existing CI workflow

---

## 🔍 Pattern mining findings (2026-05-13)

Analyzed top 4 v6 repos from the landscape snapshot: `erxes/erxes`, `rubynor/bigfive-web`, `haohanyang/mongodb-datasource`, `robvanderleek/create-issue-branch`.

**Coverage gaps identified vs. migration guides** (patterns not covered by any codemod):

| Pattern | Hop | Real-world hits | Priority |
| --- | --- | --- | --- |
| `gssapiCanonicalizeHostName` option removed | v4→v5 | 0 hits in top repos | low — niche Kerberos use case |
| Removed type exports (`Projection`, `ServerSelector`, `PipeOptions`, `ServerOptions`) | v4→v5 | 0 hits | low — consumed via TS only |
| `BulkResult.lastOp()` / `.opTime` removed | v4→v5 | 0 hits | low — rare bulk API usage |
| `commitTransaction()`/`abortTransaction()` now return `void` | v5→v6 | 0 hits | low — return value rarely used |
| `CreateCollectionOptions.autoIndexId` removed | v6→v7 | 0 hits (1 hit in bundled dist only) | low |
| `mongocryptdSpawnPath` / `cryptSharedLibPath` validation tightened | v6→v7 | 0 hits | low — CSFLE niche |

**Key observation**: Most erxes MongoDB calls are via Mongoose (`models.X.findOneAndUpdate()`), not the raw driver. Our codemods target raw `mongodb` driver usage, so Mongoose-heavy apps are out of scope by design.

**Conclusion**: No new codemods warranted from this analysis. The identified gaps are niche (Kerberos, CSFLE, GridFS edge cases) and absent from typical application code. CLI coverage is good for the common path.

---

## 🧪 Smoke tests (after the above)

- [x] ~~Write formal smoke test reports for `robvanderleek/create-issue-branch` and `ayaka-notes/overleaf-pro`~~ ✅ done — formal reports written post-fix
- [x] ~~Smoke test `erxes/erxes` (★3978, `^6.18.0`)`~~ ✅ done — 2 env checks, 0 transforms (Mongoose-driven, correct)
- [x] ~~Smoke test `rubynor/bigfive-web` (★867) and `haohanyang/mongodb-datasource` (★154)~~ ✅ done — env checks only, correct

---

## 🚧 Planned features

| Feature | Status | Notes |
| --- | --- | --- |
| v6→v7 codemod CLI | ✅ shipped | `@pavel-safronov/upgrade` on npm |
| MCP server | ✅ shipped | `packages/mcp`; v0.1.7 added `upgrade-smoke-test` and `historical-upgrade-analysis` as named MCP prompts |
| ESLint plugin | ✅ shipped | `packages/eslint-plugin`; 17 rules (v5/v6/v7), auto-fix for 13 rules, published v0.1.8 |
| GitHub ecosystem search tool | ✅ shipped | `tools/gh-search.ts`, outputs `tools/data/` |
| Upgrade smoke-test skill | ✅ shipped | `docs/skills/upgrade-smoke-test.md`, installed locally at `~/.claude/skills/upgrade-smoke-test/` |
| Historical upgrade analysis skill | ✅ shipped | `docs/skills/historical-upgrade-analysis.md`, installed locally; also exposed as MCP prompt |
| v4→v5 codemods | ✅ shipped | 8 codemods — `objectid-rename`, `remove-v4-options`, `cursor-count`, `legacy-collection-methods`, `mapreduece-removed`, `callback-api`, + 2 env checks |
| v5→v6 codemods | ✅ shipped | 10 codemods — `remove-connection-options-v6`, `bulk-result-props`, `bool-coerce`, `write-concern-options`, 4 semantic flags, + 2 env checks |

---

## 🔭 Longer-horizon ideas

- **Ongoing landscape monitoring** — re-run `gh-search` periodically (monthly?), accumulate snapshots, track version distribution over time.
- **Atlas in-product nudge** — "your app is connecting with driver v4.2; we can help you upgrade." Atlas already sees driver versions in connection metadata. Would need Atlas team buy-in; mentioned in `docs/strategy.md` §5.
- ~~**Flow file support**~~ ✅ done — files with `// @flow` pragma are now parsed with `recast/parsers/flow` (Babel + flow plugin) instead of `tsx`. All existing transforms work correctly on Flow files (same Babel AST node types). Corpus regression fixture added (`test/corpus/parse-server/`).
- **Expand `gh-search` coverage** — adding CJS patterns (`require('mongodb')`) and alternate filenames would surface repos the current approach misses.
- **GitHub Action wrapper** — wraps CLI, opens upgrade PR automatically; mentioned in `docs/strategy.md` §5.
- **Mongoose cross-team conversation** — they may want to call our codemod primitives from their own upgrade tooling.
- **Codemod for `GridFSBucketWriteStreamOptions` rename** — may have changed in v7; worth checking the changelog.

---

## 📊 Landscape snapshot (2026-05-13)

From `tools/data/gh-search-2026-05-13.json` (74 repos):

| Version | Repos |
| --- | --- |
| v2.x | 12 |
| v3.x | 17 |
| v4.x | 9 |
| v5.x | 6 |
| v6.x | 29 |
| v0.x | 1 |

Top v6 repos (upgrade targets): `erxes/erxes` (★3978), `rubynor/bigfive-web` (★867), `ayaka-notes/overleaf-pro` (★381), `robvanderleek/create-issue-branch` (★348).

---

## 🧪 Smoke test corpus

| Repo | mongodb version tested | Verdict | Report |
| --- | --- | --- | --- |
| `apostrophecms/apostrophe` | `^6.x` (monorepo sub-packages) | ✅ env checks only, correct | [report](smoke-tests/apostrophecms-apostrophe.md) |
| `parse-community/parse-server` | `^6.5.x` | ✅ 0 transforms correct (Flow files skipped gracefully) | [report](smoke-tests/parse-community-parse-server.md) |
| `loopbackio/loopback-connector-mongodb` | `^5.9.2` (v5→v7 two-hop) | ✅ 1 true positive, 2 correct env checks | [report](smoke-tests/loopbackio-loopback-connector-mongodb.md) |
| `Automattic/mongoose` | `~6.20.0` | ✅ 4/4 true positives, 0 missed | [report](smoke-tests/automattic-mongoose.md) |
| `nodkz/mongodb-memory-server` | `^6.9.0` (monorepo core) | ✅ 0 transforms + 1 dep bump, matches actual upgrade exactly | [report](smoke-tests/nodkz-mongodb-memory-server.md) |
| `erxes/erxes` | `^6.18.0` | ✅ 2 env checks, 0 transforms (Mongoose-driven app, correct) | [report](smoke-tests/erxes-erxes.md) |
| `rubynor/bigfive-web` | `6.5.0` | ✅ 2 env checks, 0 transforms | [report](smoke-tests/rubynor-bigfive-web.md) |
| `haohanyang/mongodb-datasource` | `^6.9.0` | ✅ 2 env checks in devDependencies, 0 transforms | [report](smoke-tests/haohanyang-mongodb-datasource.md) |
| `robvanderleek/create-issue-branch` | `^6.20.0` | ✅ 1 env check, node-version correctly skipped (>=22.x), 0 transforms | [report](smoke-tests/robvanderleek-create-issue-branch.md) |
| `ayaka-notes/overleaf-pro` | `6.12.0` (monorepo, 4 sub-packages) | ✅ 2 env checks per sub-package, 0 transforms; gridfs false positive confirmed fixed | [report](smoke-tests/ayaka-notes-overleaf-pro.md) |
