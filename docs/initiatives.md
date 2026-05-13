# Initiatives Tracker

Living document. Update as work progresses.

---

## 🔲 Todos (immediate)

- [x] ~~Publish v0.1.8 with the two bug fixes committed since v0.1.7~~ ✅ done
- [x] ~~Implement v4→v5 codemods~~ ✅ done — 8 codemods, 97 tests passing
- [x] ~~Implement v5→v6 codemods~~ ✅ done — 10 codemods, wired into catalog
- [ ] **Missed pattern mining** — grep the v6 repos in the landscape snapshot for patterns the CLI doesn't detect; cross-reference the v6→v7 changelog for coverage gaps (informs what to add before/during v4→v5 and v5→v6 work)
- [ ] **ESLint plugin** — audit current state (`packages/eslint-plugin`), identify what's done vs. missing, bring to shippable state
- [ ] **Landscape summary report** — small formatter over `tools/data/gh-search-*.json` showing version distribution, upgrade candidates, notable repos
- [ ] **CI regression guard** — run smoke tests against a fixed corpus on each CLI release

---

## 🧪 Smoke tests (after the above)

- [ ] Write formal smoke test reports for `robvanderleek/create-issue-branch` and `ayaka-notes/overleaf-pro` — both tested informally, bugs found, no reports written
- [ ] Smoke test `erxes/erxes` (★3978, `^6.18.0`) — highest-star v6 repo, best bug surface
- [ ] Smoke test `rubynor/bigfive-web` (★867) and `haohanyang/mongodb-datasource` (★154)

---

## 🚧 Planned features

| Feature | Status | Notes |
| --- | --- | --- |
| v6→v7 codemod CLI | ✅ shipped | `@pavel-safronov/upgrade` on npm |
| MCP server | ✅ shipped | `packages/mcp`; v0.1.7 added `upgrade-smoke-test` and `historical-upgrade-analysis` as named MCP prompts |
| ESLint plugin | 🚧 in progress | `packages/eslint-plugin` |
| GitHub ecosystem search tool | ✅ shipped | `tools/gh-search.ts`, outputs `tools/data/` |
| Upgrade smoke-test skill | ✅ shipped | `docs/skills/upgrade-smoke-test.md`, installed locally at `~/.claude/skills/upgrade-smoke-test/` |
| Historical upgrade analysis skill | ✅ shipped | `docs/skills/historical-upgrade-analysis.md`, installed locally; also exposed as MCP prompt |
| v4→v5 codemods | ✅ shipped | 8 codemods — `objectid-rename`, `remove-v4-options`, `cursor-count`, `legacy-collection-methods`, `mapreduece-removed`, `callback-api`, + 2 env checks |
| v5→v6 codemods | ✅ shipped | 10 codemods — `remove-connection-options-v6`, `bulk-result-props`, `bool-coerce`, `write-concern-options`, 4 semantic flags, + 2 env checks |

---

## 🔭 Longer-horizon ideas

- **Ongoing landscape monitoring** — re-run `gh-search` periodically (monthly?), accumulate snapshots, track version distribution over time.
- **Atlas in-product nudge** — "your app is connecting with driver v4.2; we can help you upgrade." Atlas already sees driver versions in connection metadata. Would need Atlas team buy-in; mentioned in `docs/strategy.md` §5.
- **Flow file support** — the `tsx` parser cannot handle Flow-annotated `.js` files. A separate parse pass with `@babel/parser` + `flow` plugin could unlock those files.
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
| `robvanderleek/create-issue-branch` | — | ⚠️ informal only — found bundle hang bug (issue #4) | no report |
| `ayaka-notes/overleaf-pro` | — | ⚠️ informal only — found gridfs false positive (issue #5) | no report |
