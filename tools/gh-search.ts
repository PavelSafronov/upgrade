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
