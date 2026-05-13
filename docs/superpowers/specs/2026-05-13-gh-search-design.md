# Design: GitHub Ecosystem Search Tool

**Date:** 2026-05-13
**Author:** Pavel Safronov + Claude (brainstorming session)
**Status:** Approved — ready for implementation planning

---

## Overview

A standalone TypeScript script (`tools/gh-search.ts`) that searches GitHub for public repositories using the `mongodb` npm package, groups them by driver major version, and writes results to a versioned JSON file on disk. Designed to be run locally on demand — not in CI.

**Primary use cases (in priority order):**

1. **Landscape analysis** — understand the ecosystem: how many repos are on v3/v4/v5/v6/v7, what semver ranges they use, which are upgrade candidates.
2. **Smoke test sourcing** — feed the result JSON into a future smoke-test runner that clones repos and runs the upgrade CLI against them locally.
3. **Migration study (stretch)** — extend the tool over time to find repos that already upgraded and mine their PR diffs for real-world migration patterns.

---

## Location

```text
code/upgrade/
└── tools/
    ├── gh-search.ts        # the script
    └── data/               # output files, gitignored
        └── gh-search-YYYY-MM-DD.json
```

`tools/data/` is gitignored — results accumulate locally but are never committed.

---

## Runtime

**TypeScript + `tsx`** (available globally via pnpm). No compile step.

```bash
tsx tools/gh-search.ts              # default 300 results
tsx tools/gh-search.ts --limit 100  # quicker run
tsx tools/gh-search.ts --limit 1000 # deep scan
```

**No new npm dependencies.** All GitHub API calls shell out to `gh api` — auth is handled automatically by the `gh` CLI (requires `gh auth login` to have been run once).

---

## Architecture

### Two-phase fetch (REST → GraphQL)

#### Phase 1 — Discovery (REST code search)

```bash
gh api search/code \
  -f q='filename:package.json "mongodb" NOT path:node_modules' \
  -f per_page=100 \
  --paginate
```

Returns results as `{ items: [{ repository: { full_name, html_url, stargazers_count }, path }] }`. Pagination stops as soon as the accumulated item count reaches `--limit` (no over-fetching). Deduplicates by `full_name` — same repo can appear for multiple `package.json` files. When deduplicating, prefer the entry with the shortest `path` (closest to repo root); if tied, take the first result.

#### Phase 2 — Content fetch (GraphQL, batched)

For each discovered repo, fetch the raw `package.json` content using a batched GraphQL query. 20 repos per request to stay within GitHub's GraphQL complexity limits.

```graphql
{
  r0: repository(owner: "org1", name: "repo1") {
    object(expression: "HEAD:package.json") {
      ... on Blob { text }
    }
  }
  r1: repository(owner: "org2", name: "repo2") {
    object(expression: "HEAD:package.json") {
      ... on Blob { text }
    }
  }
}
```

300 results = 15 GraphQL calls total (compared to 300 REST calls with a naive N+1 approach).

### Version extraction

Parse each `package.json` blob as JSON. Look for `dependencies.mongodb` and `devDependencies.mongodb`. Record the raw semver range string (e.g. `^4.13.0`). Derive the major version by stripping range prefixes (`^`, `~`, `>=`, `>`, `=`) and taking the leading integer.

Repos where `package.json` doesn't include `mongodb` at all (false positives from code search) are silently discarded.

---

## Output

### JSON file — `tools/data/gh-search-YYYY-MM-DD.json`

One file per run. If multiple runs happen on the same day, the second run overwrites the first.

```ts
interface SearchResult {
  meta: {
    runAt: string;        // ISO timestamp
    totalRepos: number;
    queryLimit: number;
  };
  repos: RepoEntry[];
}

interface RepoEntry {
  owner: string;
  name: string;
  stars: number;
  mongodbVersion: string;  // raw semver range from package.json, e.g. "^4.13.0"
  majorVersion: number;    // derived integer, e.g. 4
  depType: 'dependencies' | 'devDependencies';
  packageJsonPath: string; // relative path within repo, e.g. "package.json"
  url: string;             // https://github.com/owner/name
}
```

### Terminal summary

Printed after the JSON is written. Version-grouped table:

```text
MongoDB driver ecosystem snapshot — 2026-05-13
────────────────────────────────────────────────
  v3.x    12 repos   ████░░░░░░░░░░░░░░░░
  v4.x    89 repos   ████████████████████
  v5.x    61 repos   ██████████████░░░░░░
  v6.x    94 repos   █████████████████████
  v7.x    31 repos   ███████░░░░░░░░░░░░░
  other    8 repos
────────────────────────────────────────────────
  Total: 295 repos  (300 query limit, 5 discarded)
Results written to tools/data/gh-search-2026-05-13.json
```

---

## Error handling

- If `gh` is not installed or not authenticated, print a clear message and exit with code 1.
- If a repo's `package.json` can't be fetched (private repo surfaced in search, deleted repo, non-JSON content), skip it and increment a `discarded` counter.
- If a `package.json` is valid JSON but has no `mongodb` dependency, skip silently.
- Rate limit errors from GitHub (HTTP 403 with `X-RateLimit-Remaining: 0`) cause the script to print remaining results and write a partial JSON file rather than crashing.

---

## Future extension points (not in scope now)

- **Smoke-test runner** — a second script reads the JSON, clones repos into a temp dir, runs `npx @mongodb-js/upgrade --dry-run`, and records results.
- **Migration study** — extend `RepoEntry` with `upgradepr?: { url, mergedAt, filesChanged }` populated by a follow-up GraphQL query over each repo's PR history.
- **Incremental runs** — diff the latest JSON against a previous run to surface newly-discovered repos or version changes.

---

## Out of scope

- Running in CI or on a schedule.
- Searching for Mongoose or other MongoDB-adjacent packages (can be added by parameterizing the search query).
- Fetching private repos.
- Any UI or web interface.
