#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RepoEntry {
  owner: string;
  name: string;
  stars: number;
  mongodbVersion: string;
  majorVersion: number;
  depType: 'dependencies' | 'devDependencies';
  packageJsonPath: string;
  url: string;
}

export interface SearchResult {
  meta: {
    runAt: string;
    totalRepos: number;
    queryLimit: number;
  };
  repos: RepoEntry[];
}

// ── Pure functions ─────────────────────────────────────────────────────────

export function parseMongodb(
  pkgText: string
): { version: string; depType: 'dependencies' | 'devDependencies' } | null {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgText) as Record<string, unknown>;
  } catch {
    return null;
  }
  for (const depType of ['dependencies', 'devDependencies'] as const) {
    const deps = pkg[depType] as Record<string, string> | undefined;
    if (deps?.mongodb) return { version: deps.mongodb, depType };
  }
  return null;
}

export function deriveMajorVersion(version: string): number {
  const match = version.match(/(\d+)/);
  if (!match) return -1;
  return parseInt(match[1], 10);
}

export function buildGraphQLQuery(
  batch: Array<{ owner: string; name: string; path: string }>
): string {
  const fields = batch
    .map(
      (r, i) =>
        `r${i}: repository(owner: "${r.owner}", name: "${r.name}") { ` +
        `object(expression: "HEAD:${r.path}") { ... on Blob { text } } }`
    )
    .join('\n  ');
  return `{ ${fields} }`;
}

export function formatSummary(
  repos: RepoEntry[],
  limit: number,
  discarded: number,
  outputPath: string,
  date: string
): string {
  const byMajor = new Map<number, number>();
  for (const repo of repos) {
    byMajor.set(repo.majorVersion, (byMajor.get(repo.majorVersion) ?? 0) + 1);
  }

  const maxCount = Math.max(...(byMajor.size > 0 ? [...byMajor.values()] : [1]));
  const barWidth = 20;
  const lines: string[] = [];

  lines.push(`\nMongoDB driver ecosystem snapshot — ${date}`);
  lines.push('─'.repeat(50));

  const sorted = [...byMajor.entries()].sort(([a], [b]) => a - b);
  for (const [major, count] of sorted) {
    const label = major >= 0 ? `v${major}.x` : 'other';
    const filled = Math.round((count / maxCount) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    lines.push(`  ${label.padEnd(6)} ${String(count).padStart(4)} repos   ${bar}`);
  }

  lines.push('─'.repeat(50));
  lines.push(`  Total: ${repos.length} repos  (${limit} query limit, ${discarded} discarded)`);
  lines.push(`Results written to ${outputPath}`);

  return lines.join('\n');
}

// ── Internal types ─────────────────────────────────────────────────────────

type DiscoverItem = {
  repository: { full_name: string; html_url: string; stargazers_count: number };
  path: string;
};

type GqlBlobResult = Record<
  string,
  { object: { text: string } | null } | null
>;

// ── gh API helpers ─────────────────────────────────────────────────────────

export function isGhAuthenticated(): boolean {
  const result = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  return result.status === 0;
}

function ghApiJson<T>(args: string[]): T {
  const result = spawnSync('gh', ['api', ...args], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || 'gh api call failed');
  return JSON.parse(result.stdout) as T;
}

// ── Phase 1: REST code search ──────────────────────────────────────────────

export function discoverRepos(limit: number): Map<string, DiscoverItem> {
  const repos = new Map<string, DiscoverItem>();
  let page = 1;

  while (repos.size < limit) {
    const perPage = Math.min(100, limit - repos.size);
    let data: { items: DiscoverItem[] };
    try {
      data = ghApiJson<{ items: DiscoverItem[] }>([
        '--method', 'GET',
        'search/code',
        '-f', `q=filename:package.json "mongodb" NOT path:node_modules`,
        '-f', `per_page=${perPage}`,
        '-f', `page=${page}`,
      ]);
    } catch (err) {
      console.error(`Warning: search page ${page} failed: ${String(err)}`);
      break;
    }

    if (!data.items?.length) break;

    for (const item of data.items) {
      const key = item.repository.full_name;
      const existing = repos.get(key);
      // prefer the package.json closest to the repo root (shortest path)
      if (!existing || item.path.length < existing.path.length) {
        repos.set(key, item);
      }
    }

    if (data.items.length < perPage) break; // reached the last page
    page++;
  }

  return repos;
}
