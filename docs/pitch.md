# MongoDB Upgrade Toolkit — Hackathon Pitch

## The problem

Upgrading the MongoDB Node.js driver is a multi-step, error-prone process. Between `^4.x` and `^7.x` there are dozens of breaking changes: renamed methods, removed options, callback APIs replaced by promises, type-only renames, environment prerequisites. Most users don't know what applies to their code until they upgrade and hit runtime errors.

The ecosystem reflects this: a snapshot of 74 public GitHub repos shows **9 repos still on v4, 6 on v5, 29 on v6** — the majority of the addressable upgrade market hasn't moved.

## What we built

A three-package toolkit that turns a manual, multi-day upgrade into a one-command operation:

### 1. `@pavel-safronov/upgrade` — Codemod CLI

Detects your driver version, plans the hop path (e.g. v5→v6→v7), and applies **28 codemods** across all three upgrade hops:

- **Mechanical transforms** — rename methods, rewrite deprecated call patterns, update option shapes. Applied automatically, no review needed.
- **Semantic flags** — patterns that need human judgment (e.g. a `findOneAndUpdate` that should consider projection changes). Inserts a `// TODO: [upgrade]` comment with migration notes.
- **Environment checks** — validates Node.js version and bumps the `mongodb` dep in `package.json`.

Supports TypeScript, JavaScript, and Flow-annotated files. Works on monorepos.

```bash
npx @pavel-safronov/upgrade                   # auto-detect, apply everything
npx @pavel-safronov/upgrade --dry-run         # preview without writing
npx @pavel-safronov/upgrade --from 5 --to 7  # explicit hop
```

### 2. `@pavel-safronov/upgrade-mcp` — MCP Server

Exposes four tools to any MCP-capable AI agent (Claude Code, Cursor, Windsurf):

| Tool | What it does |
| --- | --- |
| `analyze_repo` | Dry-run analysis: version, hop plan, per-file breakdown |
| `apply_codemod` | Apply one codemod or all; supports `dryRun` |
| `explain_breaking_change` | Before/after example + migration notes for any breaking change |
| `verify_upgrade` | Runs the project's test suite; returns pass/fail + full output |

This closes the full agent loop: **analyze → explain → apply → verify**, without the agent ever having to read the MongoDB migration guide.

### 3. `@pavel-safronov/eslint-plugin-mongodb-upgrade` — ESLint Plugin

17 lint rules covering every breaking change across v4→v5→v6→v7. Auto-fix support for 13 of them. Integrates into any existing lint pipeline — catches regressions as they're introduced, not just at upgrade time.

### GitHub Action

A composite action that opens an upgrade PR automatically:

```yaml
- uses: PavelSafronov/upgrade@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Schedule it monthly. If there's anything to upgrade, a PR appears with the full diff and a review checklist broken down by mechanical/semantic/env change type.

## Coverage

28 codemods across three upgrade hops, validated against a smoke-test corpus of 10 real-world repos (★1–★4000):

- `apostrophecms/apostrophe`, `parse-community/parse-server`, `loopbackio/loopback-connector-mongodb`, `Automattic/mongoose`, `nodkz/mongodb-memory-server`, `erxes/erxes`, and more.
- 0 false positives in smoke tests after fixing a GridFS false positive caught during testing.
- Flow file support added after `parse-server` corpus test revealed silent skipping.

## Why it matters

- **For driver users**: upgrade in minutes instead of days. No need to read 3 migration guides.
- **For the MongoDB team**: every v4/v5/v6 user who upgrades is a user we don't lose to churn when older versions hit EOL. The GitHub Action makes upgrades a recurring, automated event rather than a one-time manual project.
- **For AI agent users**: the MCP server gives agents ground truth about MongoDB breaking changes — no hallucinated migration advice.

## Packages

All published at v0.2.0:

- [`@pavel-safronov/upgrade`](https://www.npmjs.com/package/@pavel-safronov/upgrade)
- [`@pavel-safronov/upgrade-mcp`](https://www.npmjs.com/package/@pavel-safronov/upgrade-mcp)
- [`@pavel-safronov/eslint-plugin-mongodb-upgrade`](https://www.npmjs.com/package/@pavel-safronov/eslint-plugin-mongodb-upgrade)
