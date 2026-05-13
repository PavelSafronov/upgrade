#!/usr/bin/env tsx
/**
 * landscape.ts — Reads gh-search snapshot(s) from tools/data/ and prints a
 * rich ecosystem summary: version distribution, upgrade candidates by version,
 * and a cross-snapshot delta if multiple snapshots are present.
 *
 * Usage:
 *   npx tsx tools/landscape.ts                  # latest snapshot
 *   npx tsx tools/landscape.ts --all            # all snapshots + delta
 *   npx tsx tools/landscape.ts --top 10         # show top N repos per version (default: 5)
 *   npx tsx tools/landscape.ts --version 6      # only show repos on a specific major version
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RepoEntry, SearchResult } from './gh-search.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

// ── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const topN = (() => { const i = args.indexOf('--top'); return i !== -1 ? parseInt(args[i + 1], 10) : 5; })();
const filterVersion = (() => { const i = args.indexOf('--version'); return i !== -1 ? parseInt(args[i + 1], 10) : null; })();

// ── Load snapshots ─────────────────────────────────────────────────────────

function loadSnapshots(): Array<{ file: string; date: string; result: SearchResult }> {
  const files = readdirSync(DATA_DIR)
    .filter(f => f.startsWith('gh-search-') && f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.error('No snapshot files found in tools/data/. Run npx tsx tools/gh-search.ts first.');
    process.exit(1);
  }

  return files.map(file => {
    const result = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as SearchResult;
    const date = file.replace('gh-search-', '').replace('.json', '');
    return { file, date, result };
  });
}

// ── Formatting helpers ─────────────────────────────────────────────────────

const HR = '─'.repeat(60);

function versionDistribution(repos: RepoEntry[]): string {
  const byMajor = new Map<number, RepoEntry[]>();
  for (const repo of repos) {
    if (!byMajor.has(repo.majorVersion)) byMajor.set(repo.majorVersion, []);
    byMajor.get(repo.majorVersion)!.push(repo);
  }

  const sorted = [...byMajor.entries()].sort(([a], [b]) => a - b);
  const maxCount = Math.max(...sorted.map(([, v]) => v.length));
  const barWidth = 24;

  const lines: string[] = [];
  for (const [major, group] of sorted) {
    const label = major >= 0 ? `v${major}.x` : 'other';
    const count = group.length;
    const filled = Math.round((count / maxCount) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const totalStars = group.reduce((s, r) => s + r.stars, 0);
    lines.push(`  ${label.padEnd(6)} ${String(count).padStart(4)} repos   ${bar}   ${totalStars.toLocaleString()}★`);
  }
  return lines.join('\n');
}

function topRepos(repos: RepoEntry[], version: number | null, n: number): string {
  const versions = version !== null
    ? [version]
    : [...new Set(repos.map(r => r.majorVersion))].filter(v => v >= 0).sort((a, b) => b - a);

  const sections: string[] = [];
  for (const v of versions) {
    const group = repos
      .filter(r => r.majorVersion === v)
      .sort((a, b) => b.stars - a.stars)
      .slice(0, n);
    if (group.length === 0) continue;

    sections.push(`  v${v}.x top ${Math.min(n, group.length)} repos by stars:`);
    for (const r of group) {
      const label = `${r.owner}/${r.name}`;
      const ver = r.mongodbVersion.padEnd(10);
      sections.push(`    ${String(r.stars).padStart(6)}★  ${label.padEnd(42)} ${ver}  ${r.url}`);
    }
  }
  return sections.join('\n');
}

function upgradeCandidates(repos: RepoEntry[], n: number): string {
  const candidates = repos
    .filter(r => r.majorVersion >= 4 && r.majorVersion <= 6)
    .sort((a, b) => b.stars - a.stars)
    .slice(0, n);

  if (candidates.length === 0) return '  (none in v4–v6 range)';

  const lines = candidates.map(r => {
    const label = `${r.owner}/${r.name}`;
    return `    ${String(r.stars).padStart(6)}★  ${label.padEnd(42)} mongodb@${r.mongodbVersion}`;
  });
  return lines.join('\n');
}

function delta(
  prev: { date: string; repos: RepoEntry[] },
  curr: { date: string; repos: RepoEntry[] }
): string {
  const prevByMajor = new Map<number, number>();
  const currByMajor = new Map<number, number>();
  for (const r of prev.repos) prevByMajor.set(r.majorVersion, (prevByMajor.get(r.majorVersion) ?? 0) + 1);
  for (const r of curr.repos) currByMajor.set(r.majorVersion, (currByMajor.get(r.majorVersion) ?? 0) + 1);

  const allVersions = new Set([...prevByMajor.keys(), ...currByMajor.keys()]);
  const sorted = [...allVersions].filter(v => v >= 0).sort((a, b) => a - b);

  const lines: string[] = [`  Delta: ${prev.date} → ${curr.date}`];
  for (const v of sorted) {
    const p = prevByMajor.get(v) ?? 0;
    const c = currByMajor.get(v) ?? 0;
    const diff = c - p;
    if (diff === 0) continue;
    const sign = diff > 0 ? '+' : '';
    lines.push(`    v${v}.x  ${sign}${diff} repos  (${p} → ${c})`);
  }
  if (lines.length === 1) lines.push('    (no change)');
  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────

const snapshots = loadSnapshots();
const toShow = showAll ? snapshots : [snapshots[snapshots.length - 1]];

for (const { date, result } of toShow) {
  const repos = filterVersion !== null
    ? result.repos.filter(r => r.majorVersion === filterVersion)
    : result.repos;

  console.log(`\nMongoDB driver ecosystem — ${date}`);
  console.log(HR);
  console.log('\nVersion distribution (with total stars):');
  console.log(versionDistribution(result.repos));  // always full distribution
  console.log(`\n  ${result.repos.length} repos total  (limit: ${result.meta.queryLimit})`);

  console.log('\n' + HR);
  console.log('\nUpgrade candidates (v4–v6, sorted by stars):');
  console.log(upgradeCandidates(result.repos, topN * 2));

  console.log('\n' + HR);
  console.log(filterVersion !== null
    ? `\nTop ${topN} v${filterVersion}.x repos by stars:`
    : `\nTop ${topN} repos per version:`);
  console.log(topRepos(repos, filterVersion, topN));
  console.log();
}

if (showAll && snapshots.length > 1) {
  console.log(HR);
  console.log('\nCross-snapshot deltas:');
  for (let i = 1; i < snapshots.length; i++) {
    console.log(delta(
      { date: snapshots[i - 1].date, repos: snapshots[i - 1].result.repos },
      { date: snapshots[i].date, repos: snapshots[i].result.repos }
    ));
  }
  console.log();
}
