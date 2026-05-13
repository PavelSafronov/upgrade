# MongoDB Upgrade Toolkit

AI-assisted upgrade toolkit for the MongoDB Node.js ecosystem. Deterministic codemods apply mechanical transforms automatically; semantic issues get `TODO` comments for human review; an MCP server lets Claude Code / Cursor / Copilot drive the whole thing.

## Packages

| Package | Description |
| --- | --- |
| [`@pavel-safronov/upgrade`](packages/cli) | Codemod CLI — detects your driver version, plans the staged hop path, applies transforms, emits a report |
| [`@pavel-safronov/upgrade-mcp`](packages/mcp) | MCP server — exposes `analyze_repo`, `apply_codemod`, `explain_breaking_change` tools to AI agents |
| [`@pavel-safronov/eslint-plugin-mongodb-upgrade`](packages/eslint-plugin) | ESLint plugin — 17 rules covering v4→v5→v6→v7 breaking changes, with auto-fix support |

## Supported upgrade paths

| From | To | Status |
| --- | --- | --- |
| v6.x | v7.x | ✅ complete |
| v5.x | v6.x | ✅ complete |
| v4.x | v5.x | ✅ complete |
| v4.2.x | v5.x | ✅ complete |

## Quick start (CLI)

```bash
# from your project root:
npx @pavel-safronov/upgrade                        # auto-detect version, apply all codemods
npx @pavel-safronov/upgrade --dry-run              # preview without writing
npx @pavel-safronov/upgrade --list                 # show all registered codemods
npx @pavel-safronov/upgrade --only stream-transform  # run one codemod
npx @pavel-safronov/upgrade --from 6 --to 7        # override version detection
```

See [packages/cli/README.md](packages/cli/README.md) for the full codemod catalog.

## MCP server (for AI agents)

Once wired up, an agent can call three tools:

| Tool | What it does |
| --- | --- |
| `analyze_repo` | Detects version, plans hops, returns per-file breakdown of issues (dry-run) |
| `apply_codemod` | Applies a named codemod or `"all"` codemods; supports `dryRun: true` |
| `explain_breaking_change` | Returns description, before/after example, migration notes for any codemod ID |

**Claude Code — this repo**: `.claude/settings.json` is already committed. Reopen the workspace and the `mongodb-upgrade` MCP server is available automatically.

**Other projects**: add to your agent config:

```json
{
  "mcpServers": {
    "mongodb-upgrade": {
      "command": "npx",
      "args": ["@pavel-safronov/upgrade-mcp"]
    }
  }
}
```

See [packages/mcp/README.md](packages/mcp/README.md) for full tool schemas.

## Development

```bash
npm install          # install all workspace dependencies
npm run build        # build both packages (tsup)
npm test             # run all tests (vitest, 153 tests across all packages)
```

### Testing the CLI manually

There is a kitchen-sink test app in `packages/test-app-v6` that contains every deprecated v6 API. It is tracked in git so you can reset it after any CLI run.

```bash
# 1. Preview what the CLI would change (no files written):
node packages/cli/dist/index.js packages/test-app-v6 --dry-run

# 2. Run the real upgrade:
node packages/cli/dist/index.js packages/test-app-v6

# 3. Inspect the diff:
git diff packages/test-app-v6/

# 4. Reset to the "before" state for the next demo:
git checkout -- packages/test-app-v6/
```

### Testing the MCP server manually

The MCP server speaks JSON-RPC over stdio. You can poke it directly:

```bash
# Start the server:
node packages/mcp/dist/index.js

# In another terminal, send a ListTools request:
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node packages/mcp/dist/index.js

# Or use the MCP inspector:
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js
```

### Running individual codemod tests

```bash
cd packages/cli
npm test                              # all 99 tests
npm test -- stream-transform          # just one transform
npm test -- integration               # integration tests against test-app-v4/v5/v6
```

### GitHub ecosystem search

`tools/gh-search.ts` searches GitHub for public repos that depend on the MongoDB Node.js driver and snapshots their version distribution. Useful for finding upgrade candidates and measuring ecosystem progress.

**Prerequisites:** [`gh` CLI](https://cli.github.com/) installed and authenticated (`gh auth login`).

```bash
# Run from the repo root (requires tsx):
npx tsx tools/gh-search.ts

# Limit the number of repos fetched (default: 300):
npx tsx tools/gh-search.ts --limit 100
```

Output is written to `tools/data/gh-search-YYYY-MM-DD.json` and a bar chart summary is printed to stdout:

```text
MongoDB driver ecosystem snapshot — 2026-05-13
──────────────────────────────────────────────────
  v2.x     12 repos   ████░░░░░░░░░░░░░░░░
  v3.x     17 repos   ██████████████░░░░░░
  v4.x      9 repos   ███████░░░░░░░░░░░░░
  v5.x      6 repos   █████░░░░░░░░░░░░░░░
  v6.x     29 repos   ████████████████████
──────────────────────────────────────────────────
  Total: 74 repos  (300 query limit, 12 discarded)
```

The JSON output is an array of `RepoEntry` objects:

```typescript
interface RepoEntry {
  owner: string;           // GitHub org/user
  name: string;            // repo name
  stars: number;
  mongodbVersion: string;  // raw version string from package.json, e.g. "^6.18.0"
  majorVersion: number;    // parsed major, e.g. 6
  depType: 'dependencies' | 'devDependencies';
  packageJsonPath: string; // path within the repo
  url: string;             // GitHub URL
}
```

### Landscape summary report

`tools/landscape.ts` reads existing snapshots from `tools/data/` and renders a rich report: version distribution with star counts, upgrade candidates, and top repos per version. No network calls — reads locally cached snapshots only.

```bash
npm run landscape                              # latest snapshot, top 5 per version
npx tsx tools/landscape.ts --top 10           # show top 10 repos per version
npx tsx tools/landscape.ts --version 6        # only show v6.x repos
npx tsx tools/landscape.ts --all              # all snapshots + cross-snapshot delta
```

Example output:

```text
MongoDB driver ecosystem — 2026-05-13
────────────────────────────────────────────────────────────

Version distribution (with total stars):
  v4.x      9 repos   ███████░░░░░░░░░░░░░░░░░   4,043★
  v5.x      6 repos   █████░░░░░░░░░░░░░░░░░░░     109★
  v6.x     29 repos   ████████████████████████   5,923★

Upgrade candidates (v4–v6, sorted by stars):
    3978★  erxes/erxes                          mongodb@^6.18.0
    3581★  msgbyte/tailchat                     mongodb@4.2.1
     867★  rubynor/bigfive-web                  mongodb@6.5.0
```

## Repository layout

```text
packages/
  cli/             @pavel-safronov/upgrade — CLI and all codemod logic
  mcp/             @pavel-safronov/upgrade-mcp — MCP server (thin layer over CLI)
  eslint-plugin/   @pavel-safronov/eslint-plugin-mongodb-upgrade — ESLint rules
  test-app-v6/     kitchen-sink app with every deprecated v6 API (6.x→7.x demo target)
  test-app-v5/     kitchen-sink app with every deprecated v5 API (5.x→6.x demo target)
  test-app-v4/     kitchen-sink app with every deprecated v4 API (4.x→5.x demo target)
  test-app-v4.2/   same patterns as test-app-v4, pinned to mongodb@4.2.0 (earliest v4)
tools/
  gh-search.ts     GitHub ecosystem search — finds repos using the MongoDB driver
  landscape.ts     Landscape summary report — reads snapshots, renders version distribution + upgrade candidates
  gh-search.test.ts
  data/            snapshot JSON files from past runs
docs/
  specs/           design documents
  plans/           implementation plans
  smoke-tests/     per-repo smoke test reports
  skills/          Claude skill definitions (upgrade-smoke-test, historical-upgrade-analysis)
  decisions.md     timestamped decision log
  initiatives.md   living tracker of work in progress and planned features
```

## Docs

- [Design spec](docs/specs/2026-05-11-mongodb-upgrade-toolkit-design.md)
- [Implementation plan](docs/plans/2026-05-11-mongodb-upgrade-toolkit.md)
- [Decisions log](docs/decisions.md)
- [Strategy](docs/strategy.md)
