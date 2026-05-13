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
