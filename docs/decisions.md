# Decision Log

Running timestamped log of decisions made during the hackathon.

---

## 2026-05-11 — Initial brainstorming session

**[10:00] Strategy doc accepted as-is**
Decisions from the prior Claude Desktop session (two anchor products, no web app, no hosted service, no LLM in the CLI) were carried forward without relitigating. See `mongodb-node-driver-upgrade-strategy.md` for full reasoning.

**[10:05] Hackathon success bar: A + B + C**
Goal is to have all three demoable by end of week:

- A: Working end-to-end CLI with v6→v7 transforms
- B: Complete codemod catalog + architecture proof
- C: MCP server wired to CLI, callable from Claude Code

**[10:10] Repo layout: monorepo at code/upgrade/**
New standalone repo with `packages/cli` and `packages/mcp`. Chosen over branching off node-mongodb-native (messy release story) and flat single-package layout (harder to split later). Monorepo is the eventual production shape.

**[10:15] Package naming: @mongodb-js/upgrade + @mongodb-js/upgrade-mcp**
`@mongodb-js` scope already in use (`@mongodb-js/zstd`). Short name wins at the `npx` prompt. Scope is intentionally not driver-specific — Mongoose support is a future catalog entry, not an architectural change.

**[10:20] Catalog architecture: driver-first, extensible format**
Catalog entries are package-agnostic (`packages: ["mongodb"]`). Mongoose support later is a new entry, not a new architecture. Rejected plugin architecture (too much overhead for a hackathon) and hardcoded transforms (creates debt before Mongoose conversation).

**[10:30] AST tooling: jscodeshift + ast-grep**
jscodeshift chosen over ts-morph and magicast because every major reference implementation (React, Next.js, Vercel AI SDK) uses it — patterns are freely available to learn from. ast-grep as a complement for cross-file detection. No dependency on Codemod.com (the commercial platform) — that was a reference only, not a dependency.

**[10:40] MCP transport: stdio**
Stdio chosen over HTTP for Phase 1. Zero infrastructure, zero auth surface. Supported natively by Claude Code, Cursor, Copilot. HTTP can be added later for remote/hosted scenarios.

**[10:45] Test strategy: three layers**

1. Per-codemod fixture tests (vitest, hermetic, CI)
2. Four kitchen-sink integration test apps — one per supported starting version, all git-tracked, CLI run produces the demo diff:
   - `test-app-v6/` — mongodb@6.20.0 (fully populated)
   - `test-app-v5/` — mongodb@5.8.1 (fully populated)
   - `test-app-v4/` — mongodb@4.13.0 (fully populated)
   - `test-app-v4.2/` — mongodb@4.2.0 lowest supported 4.2.x (fully populated)
3. Real-world smoke: `code/testProject/` (already on mongodb@^6.19.0), GitHub search for `"mongodb": "^6"` repos

**[10:50] v6→v7 catalog finalized**
13 mechanical transforms, 5 semantic flags, 6 environmental checks. Source of truth: `node-mongodb-native/etc/notes/CHANGES_7.0.0.md`. Full table in design doc.

**[12:55] Multiple test apps — one per starting version**
Four kitchen-sink apps: `test-app-v6/v5/v4/v4.2`, all fully populated. Each pinned to exact version. Git history is the demo — `git checkout -- packages/test-app-v6/` resets before-state.

**[13:00] No branches — commit straight to main**
Solo hackathon, no review workflow needed. Tag (`git tag demo-ready`) for snapshots instead of branches.

**[13:10] Implementation plan written — 22 tasks**
Covers monorepo scaffold → CLI core → v6→v7 codemods (13 mechanical + 5 semantic + 6 env) → test apps → MCP (3 tools). Three demo checkpoints. Saved to `docs/plans/2026-05-11-mongodb-upgrade-toolkit.md`.

---

---

## 2026-05-12 — Phase 2 + MCP completion

**Phase 2 complete:** v5→v6 and v4→v5 codemods shipped. All four test apps fully populated. CLI handles the full 4.2→7 path in one invocation.

**MCP server tests + examples added:** Unit tests for all three MCP tool functions (`analyzeRepo`, `applyCodemod`, `explainBreakingChange`). `EXAMPLES` map extended with before/after snippets for all 11 v5 and v6 codemods — previously only v7 was covered.

**test-app-v4.2 Phase 2 complete:** Fixture populated, behavioral tests run against mongodb@4.2.0, CLI integration confirms version detection and three-hop plan for the oldest supported v4 release.

**`buildReport` version format normalized:** `opts.to ?? '7.x'` in the CLI entry point was dead code (default `'7'` is never `undefined`). Fixed to `${parseInt(opts.to, 10)}.x` so CLI output now shows `4.13.0 → 7.x`, consistent with the hop format used throughout.

*Add entries here as decisions are made. Format: `[HH:MM] Decision — Reason`.*
