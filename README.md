# MongoDB Upgrade Toolkit

AI-assisted upgrade toolkit for the MongoDB Node.js ecosystem. Deterministic codemods apply mechanical transforms automatically; semantic issues get `TODO` comments for human review; an MCP server lets Claude Code / Cursor / Copilot drive the whole thing.

## Packages

| Package | Description |
| --- | --- |
| [`@mongodb-js/upgrade`](packages/cli) | Codemod CLI — detects your driver version, plans the staged hop path, applies transforms, emits a report |
| [`@mongodb-js/upgrade-mcp`](packages/mcp) | MCP server — exposes `analyze_repo`, `apply_codemod`, `explain_breaking_change` tools to AI agents |

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
npx @mongodb-js/upgrade                        # auto-detect version, apply all codemods
npx @mongodb-js/upgrade --dry-run              # preview without writing
npx @mongodb-js/upgrade --list                 # show all registered codemods
npx @mongodb-js/upgrade --only stream-transform  # run one codemod
npx @mongodb-js/upgrade --from 6 --to 7        # override version detection
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
      "args": ["@mongodb-js/upgrade-mcp"]
    }
  }
}
```

See [packages/mcp/README.md](packages/mcp/README.md) for full tool schemas.

## Development

```bash
npm install          # install all workspace dependencies
npm run build        # build both packages (tsup)
npm test             # run all tests (vitest, 122 tests across all packages)
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
npm test                              # all 87 tests
npm test -- stream-transform          # just one transform
npm test -- integration               # integration tests against test-app-v4/v5/v6
```

## Repository layout

```text
packages/
  cli/             @mongodb-js/upgrade — CLI and all codemod logic
  mcp/             @mongodb-js/upgrade-mcp — MCP server (thin layer over CLI)
  test-app-v6/     kitchen-sink app with every deprecated v6 API (6.x→7.x demo target)
  test-app-v5/     kitchen-sink app with every deprecated v5 API (5.x→6.x demo target)
  test-app-v4/     kitchen-sink app with every deprecated v4 API (4.x→5.x demo target)
  test-app-v4.2/   same patterns as test-app-v4, pinned to mongodb@4.2.0 (earliest v4)
docs/
  specs/           design documents
  plans/           implementation plans
  decisions.md     timestamped decision log
```

## Docs

- [Design spec](docs/specs/2026-05-11-mongodb-upgrade-toolkit-design.md)
- [Implementation plan](docs/plans/2026-05-11-mongodb-upgrade-toolkit.md)
- [Decisions log](docs/decisions.md)
- [Strategy](docs/strategy.md)
