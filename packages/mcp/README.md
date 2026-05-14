# @pavel-safronov/upgrade-mcp

MCP (Model Context Protocol) server that exposes MongoDB driver upgrade tools to AI agents. Thin orchestration layer over `@pavel-safronov/upgrade` — all upgrade logic lives in the CLI package.

Compatible with: Claude Code, Cursor, Windsurf, Copilot, and any MCP-capable agent.

## Install

```bash
npm install -D @pavel-safronov/upgrade-mcp
```

## Wiring up

### Claude Code

Add to `.claude/settings.json` in your project:

```json
{
  "mcpServers": {
    "mongodb-upgrade": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp/dist/index.js"]
    }
  }
}
```

Or if the package is installed globally / via npx:

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

Restart Claude Code after editing the settings file. The tools will appear as `mongodb-upgrade__analyze_repo` etc.

### Cursor / Windsurf

Add the same block to your MCP config file (`.cursor/mcp.json` or `.windsurf/mcp.json`).

## Tools

### `analyze_repo`

Scans a project and returns the current mongodb version, the planned upgrade hops, the applicable codemods, and a per-file breakdown of what would be changed — **without writing any files**.

**Input:**

```json
{ "path": "/absolute/path/to/project" }
```

**Output:**

```json
{
  "package": "mongodb",
  "currentVersion": "6.20.0",
  "plan": [{ "from": "6.x", "to": "7.x" }],
  "codemods": [
    { "id": "stream-transform", "kind": "mechanical", "description": "..." },
    ...
  ],
  "fileBreakdown": [
    { "file": "src/index.ts", "codemods": ["stream-transform", "remove-client-options"] }
  ]
}
```

---

### `apply_codemod`

Applies a named codemod — or all applicable codemods — to a project. Supports dry-run mode.

**Input:**

```json
{
  "path": "/absolute/path/to/project",
  "codemod": "stream-transform",   // or "all"
  "dryRun": false                  // optional, default false
}
```

**Output:**

```json
{
  "dryRun": false,
  "changes": [
    { "codemod": "stream-transform", "file": "src/index.ts", "status": "applied" }
  ],
  "summary": { "applied": 8, "flagged": 4 }
}
```

`status` is one of:

- `"applied"` — file was modified (mechanical transform or env check with `autoFixed`)
- `"flagged"` — TODO comment inserted (semantic), or env check that needs manual action
- `"nothing-to-do"` — transform ran but no matches found

---

### `explain_breaking_change`

Returns a human-readable explanation with before/after code and migration notes for any codemod ID.

**Input:**

```json
{ "id": "stream-transform" }
```

**Output:**

```json
{
  "id": "stream-transform",
  "description": "Replace cursor.stream({ transform: fn }) with cursor.stream().map(fn)",
  "kind": "mechanical",
  "hop": { "from": "6.x", "to": "7.x" },
  "before": "const stream = cursor.stream({ transform: JSON.stringify });",
  "after": "const stream = cursor.stream().map(JSON.stringify);",
  "notes": "The transform option has been removed...",
  "docsUrl": "https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/"
}
```

---

### `verify_upgrade`

Runs the project's test suite and returns the results. Use after `apply_codemod` to confirm the upgrade did not break anything. Detects the package manager (`npm`/`yarn`/`pnpm`) automatically from the lockfile.

**Input:**

```json
{
  "path": "/absolute/path/to/project",
  "timeout": 120   // optional — seconds before killing the run, default 120
}
```

**Output:**

```json
{
  "success": true,
  "exitCode": 0,
  "testCommand": "npm test",
  "stdout": "...test runner output...",
  "stderr": "",
  "durationMs": 4821,
  "timedOut": false
}
```

`success` is `true` only when the test command exits with code 0 and does not time out. The raw `stdout`/`stderr` are included so the agent can read specific failure messages and map them to migration issues.

---

## Typical agent workflow

```text
Agent: analyze_repo({ path: "/my/project" })
  → finds mongodb@6.20.0, 12 files affected

Agent: explain_breaking_change({ id: "stream-transform" })
  → reads the before/after, understands the change

Agent: apply_codemod({ path: "/my/project", codemod: "all", dryRun: true })
  → previews 9 transforms + 4 semantic flags, writes nothing

Agent: apply_codemod({ path: "/my/project", codemod: "all" })
  → applies everything, reports summary

Agent: verify_upgrade({ path: "/my/project" })
  → runs npm test, returns pass/fail + full output
  → if failures, agent reads stdout and maps them back to TODO comments
```

## Testing manually

```bash
# Start the server (reads JSON-RPC from stdin):
node packages/mcp/dist/index.js

# Use the MCP inspector UI:
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js

# Pipe a request directly:
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | node packages/mcp/dist/index.js
```

## Prompts

The server also exposes named MCP prompts — structured workflows that agents can invoke by name. Any MCP-connected agent gets these automatically without any extra setup.

### `upgrade-smoke-test`

A step-by-step workflow for testing the CLI against a real GitHub repo: clone, dry-run, classify each transform as true/false positive, grep for missed items, report findings.

### `historical-upgrade-analysis`

A workflow for repos already on v7+: finds the upgrade commit in git history, checks out the pre-upgrade state, runs the CLI, and compares its predictions against what the developer actually changed. The developer's actual diff is the ground truth for classification.

Prompts are invoked via `prompts/get` in the MCP protocol. In Claude Code:

```text
/mcp mongodb-upgrade upgrade-smoke-test
/mcp mongodb-upgrade historical-upgrade-analysis
```

## Development

```bash
cd packages/mcp
npm run build    # tsup ESM output
npm test         # passes with no test files (tests are in the CLI package)
```
