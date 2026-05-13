# Initiatives Tracker

Living document. Update as work progresses.

---

## 🔲 Todos (immediate)

- [ ] Publish v0.1.8 with the two bug fixes committed since v0.1.7 (`ac68e55`, `7257c33`) and push to origin
- [ ] Smoke test `erxes/erxes` (★3978, `^6.18.0`) — highest-star v6 repo, best bug surface
- [ ] Run smoke tests against other high-star v6 repos from the landscape snapshot: `rubynor/bigfive-web` (★867), `haohanyang/mongodb-datasource` (★154)
- [ ] Write formal smoke test reports for `robvanderleek/create-issue-branch` and `ayaka-notes/overleaf-pro` — both were tested informally (bugs 4 and 5 were found there) but no reports written

---

## 🚧 Planned features

| Feature | Status | Notes |
|---------|--------|-------|
| v6→v7 codemod CLI | ✅ shipped | `@pavel-safronov/upgrade` on npm |
| MCP server | ✅ shipped | `packages/mcp`; v0.1.7 added `upgrade-smoke-test` and `historical-upgrade-analysis` as named MCP prompts |
| ESLint plugin | 🚧 in progress | `packages/eslint-plugin` |
| GitHub ecosystem search tool | ✅ shipped | `tools/gh-search.ts`, outputs `tools/data/` |
| Upgrade smoke-test skill | ✅ shipped | `docs/skills/upgrade-smoke-test.md`, installed locally at `~/.claude/skills/upgrade-smoke-test/` |
| Historical upgrade analysis skill | ✅ shipped | `docs/skills/historical-upgrade-analysis.md`, installed locally; also exposed as MCP prompt |
| v4→v5 codemods | 📋 planned | Plan at `docs/superpowers/plans/2026-05-12-v4-to-v5-codemods.md` |
| v5→v6 codemods | 📋 planned | Plan at `docs/superpowers/plans/2026-05-12-v5-to-v6-codemods.md` |
| GitHub Action wrapper | 📋 planned | Wraps CLI, opens upgrade PR; mentioned in `docs/strategy.md` §5 |
| Mongoose cross-team conversation | 💡 idea | They may want to call our codemod primitives from their own upgrade tooling |

---

## 🔭 Hypotheticals to explore

- **Ongoing landscape monitoring** — re-run `gh-search` periodically (monthly?), accumulate snapshots, track version distribution over time. Useful for measuring ecosystem progress.
- **Atlas in-product nudge** — "your app is connecting with driver v4.2; we can help you upgrade." Atlas already sees driver versions in connection metadata. Would need Atlas team buy-in; mentioned in `docs/strategy.md` §5.
- **CI integration for smoke tests** — run the smoke test skill automatically against a fixed corpus of repos on each CLI release, catch regressions before publish.
- **Missed pattern mining** — grep a larger set of v6 repos for patterns the CLI doesn't currently detect. Cross-reference against the v6→v7 changelog to find gaps in codemod coverage.
- **Flow file support** — the `tsx` parser cannot handle Flow-annotated `.js` files (e.g. parse-server). A separate parse pass with `@babel/parser` + `flow` plugin could unlock those files.

---

## 🧭 Open proposals / natural next directions

- **Expand `gh-search` coverage** — current queries find `filename:package.json mongodb` via GitHub code search. Adding CJS patterns (`require('mongodb')`) and alternate filenames would surface repos the current approach misses.
- **Smoke test corpus curation** — maintain a short list of "canonical smoke test repos" across version ranges, with expected CLI output documented. Makes it easy to detect regressions.
- **Landscape summary report** — `gh-search` outputs raw JSON; a small formatter that summarizes version distribution, upgrade candidates, and interesting repos would make the data more actionable.
- **Full v4→v7 upgrade path** — the CLI infrastructure already handles multi-hop upgrades; the plan builder chains v4→v5, v5→v6, and v6→v7 automatically. The gap is that the v4→v5 and v5→v6 codemod catalogs are incomplete (plans written, not yet implemented). Completing those plans closes the full upgrade path.
- **Codemod for `GridFSBucketWriteStreamOptions` rename** — may have changed in v7; worth checking the changelog and adding a transform if so.

---

## 📊 Landscape snapshot (2026-05-13)

From `tools/data/gh-search-2026-05-13.json` (74 repos):

| Version | Repos |
|---------|-------|
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
