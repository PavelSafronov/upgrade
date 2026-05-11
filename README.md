# @mongodb-js/upgrade

AI-assisted upgrade toolkit for the MongoDB Node.js ecosystem.

## Packages

| Package | Description |
| --- | --- |
| [`@mongodb-js/upgrade`](packages/cli) | Deterministic codemod CLI — detects your driver version, plans the staged upgrade path, applies mechanical transforms, and flags semantic issues for human review. No LLM, no network calls beyond `npm install`. |
| [`@mongodb-js/upgrade-mcp`](packages/mcp) | MCP server that exposes upgrade-aware tools to AI agents (Claude Code, Cursor, Copilot, Windsurf). Thin orchestration layer over the CLI. |

## Quick start

```bash
npx @mongodb-js/upgrade
```

Run from your project root. Detects your `mongodb` version and applies all applicable transforms.

```bash
npx @mongodb-js/upgrade --dry-run    # preview changes without writing
npx @mongodb-js/upgrade --list       # show available codemods
npx @mongodb-js/upgrade --only=stream-transform  # run one codemod
```

## MCP server

Add to your agent config (Claude Code, Cursor, etc.):

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

## Docs

- [Strategy](docs/strategy.md) — why this exists, what we're building, phased rollout plan
- [Design spec](docs/specs/2026-05-11-mongodb-upgrade-toolkit-design.md) — architecture, catalog, test strategy
- [Decisions](docs/decisions.md) — running log of decisions made during development

## Development

```bash
npm install          # install all workspace dependencies
npm run build        # build all packages
npm test             # run all tests
```

## Supported upgrade paths

| From | To | Status |
| --- | --- | --- |
| v6.x | v7.x | ✅ Phase 1 — in progress |
| v5.x | v6.x | 🔜 Phase 2 |
| v4.x | v5.x | 🔜 Phase 2 |
| v4.2.x | v5.x | 🔜 Phase 2 |
