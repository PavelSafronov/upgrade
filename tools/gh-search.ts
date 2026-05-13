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

// ── Phase 2: GraphQL batch fetch ───────────────────────────────────────────

const BATCH_SIZE = 20;

export function fetchBatch(
  batch: Array<{ owner: string; name: string; path: string }>
): GqlBlobResult {
  const query = buildGraphQLQuery(batch);
  const result = spawnSync('gh', ['api', 'graphql', '-f', `query=${query}`], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || 'GraphQL request failed');
  const data = JSON.parse(result.stdout) as { data: GqlBlobResult };
  return data.data;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 300;

  if (!isGhAuthenticated()) {
    console.error('Error: gh CLI not found or not authenticated. Run: gh auth login');
    process.exit(1);
  }

  console.log(`Searching GitHub for repos using mongodb (limit: ${limit})...`);
  const discovered = discoverRepos(limit);
  console.log(`Found ${discovered.size} unique repos. Fetching package.json contents...`);

  const items = [...discovered.entries()].map(([fullName, item]) => {
    const [owner, name] = fullName.split('/');
    return {
      owner,
      name,
      path: item.path,
      stars: item.repository.stargazers_count,
      url: item.repository.html_url,
    };
  });

  const batches: typeof items[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  const repos: RepoEntry[] = [];
  let discarded = 0;

  for (let i = 0; i < batches.length; i++) {
    process.stdout.write(`  Batch ${i + 1}/${batches.length}...\r`);
    const batch = batches[i];
    let batchData: GqlBlobResult;
    try {
      batchData = fetchBatch(batch);
    } catch (err) {
      console.error(`\nWarning: batch ${i + 1} failed: ${String(err)}`);
      discarded += batch.length;
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const text = batchData[`r${j}`]?.object?.text;
      if (!text) { discarded++; continue; }
      const parsed = parseMongodb(text);
      if (!parsed) { discarded++; continue; }

      repos.push({
        owner: item.owner,
        name: item.name,
        stars: item.stars,
        mongodbVersion: parsed.version,
        majorVersion: deriveMajorVersion(parsed.version),
        depType: parsed.depType,
        packageJsonPath: item.path,
        url: item.url,
      });
    }
  }
  console.log(''); // end the \r progress line

  const date = new Date().toISOString().slice(0, 10);
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outputDir = join(__dirname, 'data');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `gh-search-${date}.json`);

  const output: SearchResult = {
    meta: { runAt: new Date().toISOString(), totalRepos: repos.length, queryLimit: limit },
    repos,
  };
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(formatSummary(repos, limit, discarded, outputPath, date));
}

// Only run when invoked directly — not when imported by vitest
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal:', (err as Error).message);
    process.exit(1);
  });
}
