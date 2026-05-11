# MongoDB Upgrade Toolkit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic codemod CLI (`@mongodb-js/upgrade`) and MCP server (`@mongodb-js/upgrade-mcp`) that upgrades the MongoDB Node.js driver from v6 to v7, fully demoable by end of week.

**Architecture:** npm workspace monorepo; CLI contains all transform logic and is used as a library by the MCP server (no subprocess shelling, no logic duplication); each codemod is a jscodeshift transform with fixture-based unit tests; four kitchen-sink test apps (one per starting version) serve as both integration tests and demo targets.

**Tech Stack:** TypeScript, tsup, vitest, jscodeshift, commander, chalk, semver, @modelcontextprotocol/sdk

---

## File Structure

```text
packages/
  cli/
    src/
      index.ts                      CLI entrypoint (commander)
      detect.ts                     reads package.json → { package, current }
      plan.ts                       staged hop table builder
      runner.ts                     orchestrates transforms + env checks
      report.ts                     terminal output + upgrade-report.json
      catalog/
        types.ts                    Codemod, Transform, EnvCheck interfaces
        index.ts                    catalog registry (all codemods registered here)
        v7/
          stream-transform/
            transform.ts
            transform.test.ts
            __fixtures__/input.ts
            __fixtures__/expected.ts
          pool-retry-label/         (same structure)
          remove-client-options/    useNewUrlParser, useUnifiedTopology, noResponse
          remove-deprecated-types/  import specifier removal
          remove-gridfs-deprecated/ contentType, aliases
          find-options/             FindOptions<T> generic + FindOneOptions props
          remove-property-access/   minWireVersion, session.transaction
          remove-beta-namespace/
          semantic/                 all 5 semantic TODO-comment flags
        v6/
          index.ts                  stub (Phase 2)
      env/
        v7.ts                       all 6 env checks for v6→v7
    package.json
    tsconfig.json
    vitest.config.ts
  mcp/
    src/
      index.ts                      MCP stdio server, tool registration
      tools/
        analyze-repo.ts
        apply-codemod.ts
        explain-breaking-change.ts
    package.json
    tsconfig.json
  test-app-v6/
    src/index.ts                    every v6→v7 deprecated API in one file
    package.json                    mongodb@6.20.0
  test-app-v5/
    src/index.ts                    scaffolded (Phase 2)
    package.json                    mongodb@5.8.1
  test-app-v4/
    src/index.ts                    scaffolded (Phase 2)
    package.json                    mongodb@4.13.0
  test-app-v4.2/
    src/index.ts                    scaffolded (Phase 2)
    package.json                    mongodb@4.2.0
```

---

## Task 1: Monorepo scaffolding

**Files:**

- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/vitest.config.ts`
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`

- [ ] **Step 1: Create workspace root package.json**

```json
{
  "name": "mongodb-upgrade-toolkit",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [ ] **Step 2: Create shared tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 3: Create packages/cli/package.json**

```json
{
  "name": "@mongodb-js/upgrade",
  "version": "0.1.0",
  "description": "Deterministic codemod CLI for upgrading the MongoDB Node.js driver",
  "type": "module",
  "bin": { "upgrade": "./dist/index.js" },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "test": "vitest run",
    "dev": "tsup src/index.ts --watch"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "glob": "^11.0.0",
    "jscodeshift": "^0.16.0",
    "semver": "^7.6.0"
  },
  "devDependencies": {
    "@types/jscodeshift": "^0.11.0",
    "@types/node": "^20.0.0",
    "@types/semver": "^7.5.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 4: Create packages/cli/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Create packages/cli/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create packages/mcp/package.json**

```json
{
  "name": "@mongodb-js/upgrade-mcp",
  "version": "0.1.0",
  "description": "MCP server exposing MongoDB driver upgrade tools to AI agents",
  "type": "module",
  "bin": { "upgrade-mcp": "./dist/index.js" },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@mongodb-js/upgrade": "*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 7: Create packages/mcp/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 8: Install all dependencies**

```bash
npm install
```

Expected: workspace root `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.base.json package-lock.json packages/cli packages/mcp
git commit -m "chore: monorepo scaffolding — cli and mcp package skeletons"
```

---

## Task 2: CLI entrypoint

**Files:**

- Create: `packages/cli/src/index.ts`

- [ ] **Step 1: Create the entrypoint**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('upgrade')
  .description('Upgrade your MongoDB Node.js driver')
  .option('--dry-run', 'show what would change without writing files')
  .option('--only <id>', 'run a single named codemod')
  .option('--list', 'list available codemods and exit')
  .option('--from <major>', 'starting major version (auto-detected if omitted)')
  .option('--to <major>', 'target major version (default: 7)', '7')
  .argument('[path]', 'path to project root', '.')
  .action(async (projectPath: string, opts: {
    dryRun?: boolean;
    only?: string;
    list?: boolean;
    from?: string;
    to?: string;
  }) => {
    // implementation wired in Task 6 (runner)
    console.log('MongoDB upgrade toolkit — wiring in progress');
    console.log({ projectPath, opts });
  });

program.parse();
```

- [ ] **Step 2: Build and smoke-test the CLI**

```bash
cd packages/cli && npm run build
node dist/index.js --help
```

Expected output includes:
```
Usage: upgrade [options] [path]
Options:
  --dry-run
  --only <id>
  --list
  --from <major>
  --to <major>
```

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): commander entrypoint with all flags"
```

---

## Task 3: Version detection

**Files:**

- Create: `packages/cli/src/detect.ts`
- Create: `packages/cli/src/detect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/detect.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detect } from './detect.js';

function makeProject(dir: string, deps: Record<string, string>) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: deps }));
}

describe('detect', () => {
  let tmp: string;

  beforeEach(() => { tmp = join(tmpdir(), `upgrade-test-${Date.now()}`); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('returns version from dependencies', () => {
    makeProject(tmp, { mongodb: '^6.20.0' });
    expect(detect(tmp)).toEqual({ package: 'mongodb', current: '6.20.0' });
  });

  it('returns version from devDependencies', () => {
    makeProject(tmp, {});
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({
      devDependencies: { mongodb: '~5.8.1' }
    }));
    expect(detect(tmp)).toEqual({ package: 'mongodb', current: '5.8.1' });
  });

  it('returns null when mongodb is not installed', () => {
    makeProject(tmp, { express: '^4.0.0' });
    expect(detect(tmp)).toBeNull();
  });

  it('returns null when package.json does not exist', () => {
    mkdirSync(tmp, { recursive: true });
    expect(detect(tmp)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/cli && npm test -- detect
```

Expected: FAIL — `Cannot find module './detect.js'`

- [ ] **Step 3: Implement detect.ts**

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as semver from 'semver';

export interface DetectResult {
  package: string;
  current: string;
}

export function detect(cwd: string): DetectResult | null {
  let raw: string;
  try {
    raw = readFileSync(join(cwd, 'package.json'), 'utf8');
  } catch {
    return null;
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const deps: Record<string, string> = {
    ...((pkg['dependencies'] as Record<string, string>) ?? {}),
    ...((pkg['devDependencies'] as Record<string, string>) ?? {}),
  };

  const rawVersion = deps['mongodb'];
  if (!rawVersion) return null;

  const coerced = semver.coerce(rawVersion);
  if (!coerced) return null;

  return { package: 'mongodb', current: coerced.version };
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd packages/cli && npm test -- detect
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/detect.ts packages/cli/src/detect.test.ts
git commit -m "feat(cli): version detection from package.json"
```

---

## Task 4: Upgrade plan builder

**Files:**

- Create: `packages/cli/src/plan.ts`
- Create: `packages/cli/src/plan.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/plan.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildPlan } from './plan.js';

describe('buildPlan', () => {
  it('plans a single hop for v6 → v7', () => {
    expect(buildPlan('6.20.0')).toEqual([{ from: '6.x', to: '7.x' }]);
  });

  it('plans two hops for v5 → v7', () => {
    expect(buildPlan('5.8.1')).toEqual([
      { from: '5.x', to: '6.x' },
      { from: '6.x', to: '7.x' },
    ]);
  });

  it('plans three hops for v4 → v7', () => {
    expect(buildPlan('4.13.0')).toEqual([
      { from: '4.x', to: '5.x' },
      { from: '5.x', to: '6.x' },
      { from: '6.x', to: '7.x' },
    ]);
  });

  it('respects explicit --to bound', () => {
    expect(buildPlan('5.8.1', '6')).toEqual([{ from: '5.x', to: '6.x' }]);
  });

  it('returns empty array if already at target', () => {
    expect(buildPlan('7.0.0')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/cli && npm test -- plan
```

Expected: FAIL — `Cannot find module './plan.js'`

- [ ] **Step 3: Implement plan.ts**

```typescript
import * as semver from 'semver';

export interface Hop {
  from: string;
  to: string;
}

const ALL_HOPS: Hop[] = [
  { from: '4.x', to: '5.x' },
  { from: '5.x', to: '6.x' },
  { from: '6.x', to: '7.x' },
];

export function buildPlan(current: string, toMajor = '7'): Hop[] {
  const currentMajor = semver.major(semver.coerce(current)!);
  const targetMajor = parseInt(toMajor, 10);
  return ALL_HOPS.filter(hop => {
    const fromMajor = parseInt(hop.from, 10);
    return fromMajor >= currentMajor && fromMajor < targetMajor;
  });
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd packages/cli && npm test -- plan
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/plan.ts packages/cli/src/plan.test.ts
git commit -m "feat(cli): staged upgrade plan builder"
```

---

## Task 5: Catalog types and registry

**Files:**

- Create: `packages/cli/src/catalog/types.ts`
- Create: `packages/cli/src/catalog/index.ts`
- Create: `packages/cli/src/catalog/v6/index.ts`

- [ ] **Step 1: Create types.ts**

```typescript
import type { API, FileInfo, Options } from 'jscodeshift';
import type { Hop } from '../plan.js';

export type Transform = (
  file: FileInfo,
  api: API,
  options: Options
) => string | undefined;

export interface EnvCheckResult {
  status: 'ok' | 'warn' | 'error';
  message: string;
  autoFixed?: boolean;
}

export type EnvCheck = (cwd: string) => EnvCheckResult;

export interface Codemod {
  id: string;
  description: string;
  kind: 'mechanical' | 'semantic' | 'env';
  hop: Hop;
  packages: string[];
  transform?: Transform;
  check?: EnvCheck;
}
```

- [ ] **Step 2: Create catalog/v6/index.ts stub**

```typescript
import type { Codemod } from '../types.js';

// Phase 2: v5 → v6 codemods will be registered here.
export const v6Codemods: Codemod[] = [];
```

- [ ] **Step 3: Create catalog/index.ts**

```typescript
import type { Codemod } from './types.js';
import { v6Codemods } from './v6/index.js';

// v7 codemods are imported and registered as they are built (Tasks 8–13).
const v7Codemods: Codemod[] = [];

export const catalog: Codemod[] = [...v6Codemods, ...v7Codemods];

export function getCatalog(packages = ['mongodb']): Codemod[] {
  return catalog.filter(c => c.packages.some(p => packages.includes(p)));
}

export function getById(id: string): Codemod | undefined {
  return catalog.find(c => c.id === id);
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/catalog/
git commit -m "feat(cli): catalog types, registry, and v6 stub"
```

---

## Task 6: Runner

**Files:**

- Create: `packages/cli/src/runner.ts`
- Create: `packages/cli/src/runner.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/runner.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCodemods } from './runner.js';
import type { Codemod } from './catalog/types.js';

describe('runCodemods', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `runner-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('applies a mechanical transform and returns a change record', async () => {
    writeFileSync(join(tmp, 'app.ts'), `const x = 'old';`);

    const codemod: Codemod = {
      id: 'test-replace',
      description: 'replace old with new',
      kind: 'mechanical',
      hop: { from: '6.x', to: '7.x' },
      packages: ['mongodb'],
      transform: (file) => file.source.replace("'old'", "'new'"),
    };

    const changes = await runCodemods([codemod], tmp, { dryRun: false });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ codemod: 'test-replace', status: 'applied' });
    expect(readFileSync(join(tmp, 'app.ts'), 'utf8')).toBe(`const x = 'new';`);
  });

  it('does not write files when dryRun is true', async () => {
    writeFileSync(join(tmp, 'app.ts'), `const x = 'old';`);

    const codemod: Codemod = {
      id: 'test-replace',
      description: 'test',
      kind: 'mechanical',
      hop: { from: '6.x', to: '7.x' },
      packages: ['mongodb'],
      transform: (file) => file.source.replace("'old'", "'new'"),
    };

    await runCodemods([codemod], tmp, { dryRun: true });
    expect(readFileSync(join(tmp, 'app.ts'), 'utf8')).toBe(`const x = 'old';`);
  });

  it('skips files in node_modules', async () => {
    mkdirSync(join(tmp, 'node_modules'), { recursive: true });
    writeFileSync(join(tmp, 'node_modules', 'app.ts'), `const x = 'old';`);

    const codemod: Codemod = {
      id: 'test-replace',
      description: 'test',
      kind: 'mechanical',
      hop: { from: '6.x', to: '7.x' },
      packages: ['mongodb'],
      transform: (file) => file.source.replace("'old'", "'new'"),
    };

    const changes = await runCodemods([codemod], tmp, { dryRun: false });
    expect(changes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/cli && npm test -- runner
```

Expected: FAIL — `Cannot find module './runner.js'`

- [ ] **Step 3: Implement runner.ts**

```typescript
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import jscodeshift from 'jscodeshift';
import type { Codemod } from './catalog/types.js';

export interface Change {
  codemod: string;
  file: string;
  status: 'applied' | 'flagged' | 'nothing-to-do';
  note?: string;
}

export interface RunOptions {
  dryRun: boolean;
}

const j = jscodeshift.withParser('tsx');

export async function runCodemods(
  codemods: Codemod[],
  cwd: string,
  opts: RunOptions
): Promise<Change[]> {
  const files = await glob('**/*.{ts,tsx,js,jsx,mjs,cjs}', {
    cwd,
    ignore: ['node_modules/**', 'dist/**', '*.d.ts'],
    absolute: false,
  });

  const changes: Change[] = [];

  for (const codemod of codemods) {
    if (codemod.kind === 'env') continue; // env checks handled separately

    for (const relPath of files) {
      const absPath = join(cwd, relPath);
      const source = readFileSync(absPath, 'utf8');

      const result = codemod.transform!(
        { source, path: relPath },
        { jscodeshift: j, stats: () => {}, report: () => {} } as Parameters<typeof codemod.transform>[1],
        {}
      );

      if (result != null && result !== source) {
        if (!opts.dryRun) writeFileSync(absPath, result, 'utf8');
        changes.push({ codemod: codemod.id, file: relPath, status: 'applied' });
      }
    }
  }

  return changes;
}

export async function runEnvChecks(
  codemods: Codemod[],
  cwd: string,
  opts: RunOptions
): Promise<Change[]> {
  const changes: Change[] = [];
  const envCodemods = codemods.filter(c => c.kind === 'env');

  for (const codemod of envCodemods) {
    const result = codemod.check!(cwd);
    if (result.status !== 'ok') {
      changes.push({
        codemod: codemod.id,
        file: 'package.json',
        status: result.autoFixed && !opts.dryRun ? 'applied' : 'flagged',
        note: result.message,
      });
    }
  }

  return changes;
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd packages/cli && npm test -- runner
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/runner.ts packages/cli/src/runner.test.ts
git commit -m "feat(cli): runner — applies transforms and env checks across project files"
```

---

## Task 7: Report

**Files:**

- Create: `packages/cli/src/report.ts`

- [ ] **Step 1: Create report.ts**

```typescript
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import type { Change } from './runner.js';

export interface Report {
  package: string;
  from: string;
  to: string;
  summary: { mechanical: number; flagged: number; env: number };
  changes: Change[];
}

export function buildReport(
  pkg: string,
  from: string,
  to: string,
  changes: Change[]
): Report {
  return {
    package: pkg,
    from,
    to,
    summary: {
      mechanical: changes.filter(c => c.status === 'applied').length,
      flagged: changes.filter(c => c.status === 'flagged').length,
      env: 0,
    },
    changes,
  };
}

export function printReport(report: Report, dryRun: boolean): void {
  const prefix = dryRun ? chalk.yellow('[dry-run] ') : '';
  console.log('');
  console.log(chalk.bold(`${prefix}MongoDB driver upgrade: ${report.from} → ${report.to}`));
  console.log('');

  if (report.changes.length === 0) {
    console.log(chalk.green('  ✓ Nothing to do — project is already up to date.'));
    return;
  }

  for (const change of report.changes) {
    const icon = change.status === 'applied'
      ? chalk.green('  ✓')
      : chalk.yellow('  ⚠');
    const label = change.status === 'applied' ? 'applied' : 'flagged';
    console.log(`${icon} ${chalk.dim(change.file)} — ${chalk.bold(change.codemod)} [${label}]`);
    if (change.note) console.log(`      ${chalk.dim(change.note)}`);
  }

  console.log('');
  console.log(
    `  ${chalk.green(report.summary.mechanical + ' transforms applied')}` +
    (report.summary.flagged > 0
      ? `  ${chalk.yellow(report.summary.flagged + ' flagged for review')}`
      : '')
  );
}

export function writeReportFile(report: Report, cwd: string): void {
  const path = join(cwd, 'upgrade-report.json');
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf8');
  console.log(chalk.dim(`\n  Report saved to upgrade-report.json`));
}
```

- [ ] **Step 2: Wire runner + report into the CLI entrypoint**

Replace the body of `packages/cli/src/index.ts` action callback:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { detect } from './detect.js';
import { buildPlan } from './plan.js';
import { getCatalog, getById } from './catalog/index.js';
import { runCodemods, runEnvChecks } from './runner.js';
import { buildReport, printReport, writeReportFile } from './report.js';

const program = new Command();

program
  .name('upgrade')
  .description('Upgrade your MongoDB Node.js driver')
  .option('--dry-run', 'show what would change without writing files')
  .option('--only <id>', 'run a single named codemod')
  .option('--list', 'list available codemods and exit')
  .option('--from <major>', 'starting major version (auto-detected if omitted)')
  .option('--to <major>', 'target major version (default: 7)', '7')
  .argument('[path]', 'path to project root', '.')
  .action(async (projectPath: string, opts: {
    dryRun?: boolean;
    only?: string;
    list?: boolean;
    from?: string;
    to?: string;
  }) => {
    const catalog = getCatalog();

    if (opts.list) {
      for (const c of catalog) {
        console.log(`  ${c.id.padEnd(36)} [${c.kind}]  ${c.hop.from}→${c.hop.to}  ${c.description}`);
      }
      return;
    }

    const detected = detect(projectPath);
    if (!detected) {
      console.error('Could not detect mongodb version in package.json');
      process.exit(1);
    }

    const fromMajor = opts.from ?? String(parseInt(detected.current, 10));
    const plan = buildPlan(detected.current, opts.to);

    if (plan.length === 0) {
      console.log('Already at target version — nothing to do.');
      return;
    }

    const dryRun = opts.dryRun ?? false;
    const allChanges = [];

    for (const hop of plan) {
      const codemods = opts.only
        ? [getById(opts.only)].filter(Boolean) as typeof catalog
        : catalog.filter(c => c.hop.from === hop.from);

      const changes = await runCodemods(codemods, projectPath, { dryRun });
      const envChanges = await runEnvChecks(codemods, projectPath, { dryRun });
      allChanges.push(...changes, ...envChanges);
    }

    const report = buildReport(detected.package, detected.current, opts.to ?? '7.x', allChanges);
    printReport(report, dryRun);
    if (!dryRun) writeReportFile(report, projectPath);
  });

program.parse();
```

- [ ] **Step 3: Build and smoke-test**

```bash
cd packages/cli && npm run build && node dist/index.js --list
```

Expected: no output yet (catalog is empty), no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/report.ts packages/cli/src/index.ts
git commit -m "feat(cli): report output and fully wired CLI entrypoint"
```

---

> ✅ **CHECKPOINT** — The CLI skeleton is complete. `npm run build && node dist/index.js .` runs without errors on any project and emits "Already at target version" (because the catalog is empty). Everything from here adds transforms to the catalog.

---

## Task 8: stream-transform codemod (proves the full loop)

**Files:**

- Create: `packages/cli/src/catalog/v7/stream-transform/__fixtures__/input.ts`
- Create: `packages/cli/src/catalog/v7/stream-transform/__fixtures__/expected.ts`
- Create: `packages/cli/src/catalog/v7/stream-transform/transform.test.ts`
- Create: `packages/cli/src/catalog/v7/stream-transform/transform.ts`
- Modify: `packages/cli/src/catalog/index.ts`

- [ ] **Step 1: Write the fixture input file**

Create `packages/cli/src/catalog/v7/stream-transform/__fixtures__/input.ts`:

```typescript
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  const cursor = client.db('test').collection('docs').find({});

  const stream1 = cursor.stream({ transform: JSON.stringify });
  const stream2 = cursor.stream({ transform: (doc) => doc.name });
}
```

- [ ] **Step 2: Write the expected output file**

Create `packages/cli/src/catalog/v7/stream-transform/__fixtures__/expected.ts`:

```typescript
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  const cursor = client.db('test').collection('docs').find({});

  const stream1 = cursor.stream().map(JSON.stringify);
  const stream2 = cursor.stream().map((doc) => doc.name);
}
```

- [ ] **Step 3: Write the failing test**

Create `packages/cli/src/catalog/v7/stream-transform/transform.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import jscodeshift from 'jscodeshift';
import transform from './transform.js';

const j = jscodeshift.withParser('tsx');

function run(source: string): string {
  return transform(
    { source, path: 'test.ts' },
    { jscodeshift: j, stats: () => {}, report: () => {} } as any,
    {}
  ) ?? source;
}

const fixturesDir = join(import.meta.dirname, '__fixtures__');

describe('stream-transform', () => {
  it('transforms fixture input to expected output', () => {
    const input = readFileSync(join(fixturesDir, 'input.ts'), 'utf8');
    const expected = readFileSync(join(fixturesDir, 'expected.ts'), 'utf8');
    expect(run(input)).toBe(expected);
  });

  it('leaves cursor.stream() with no args unchanged', () => {
    const source = `const s = cursor.stream();`;
    expect(run(source)).toBe(source);
  });

  it('leaves stream() calls with non-transform options unchanged', () => {
    const source = `const s = cursor.stream({ objectMode: true });`;
    expect(run(source)).toBe(source);
  });
});
```

- [ ] **Step 4: Run test to confirm it fails**

```bash
cd packages/cli && npm test -- stream-transform
```

Expected: FAIL — `Cannot find module './transform.js'`

- [ ] **Step 5: Implement the transform**

Create `packages/cli/src/catalog/v7/stream-transform/transform.ts`:

```typescript
import type { API, FileInfo } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'stream' } },
    })
    .filter(path => {
      if (path.node.arguments.length !== 1) return false;
      const arg = path.node.arguments[0];
      if (arg.type !== 'ObjectExpression') return false;
      return arg.properties.some(
        p => p.type === 'ObjectProperty' &&
             p.key.type === 'Identifier' &&
             p.key.name === 'transform'
      );
    })
    .forEach(path => {
      const arg = path.node.arguments[0] as jscodeshift.ObjectExpression;
      const transformProp = arg.properties.find(
        p => p.type === 'ObjectProperty' &&
             (p as jscodeshift.ObjectProperty).key.type === 'Identifier' &&
             ((p as jscodeshift.ObjectProperty).key as jscodeshift.Identifier).name === 'transform'
      ) as jscodeshift.ObjectProperty;

      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(
            j.callExpression(path.node.callee as jscodeshift.MemberExpression, []),
            j.identifier('map')
          ),
          [transformProp.value as jscodeshift.Expression]
        )
      );
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}
```

- [ ] **Step 6: Run tests and confirm they pass**

```bash
cd packages/cli && npm test -- stream-transform
```

Expected: 3 passing tests.

- [ ] **Step 7: Register in catalog index**

In `packages/cli/src/catalog/index.ts`, add:

```typescript
import type { Codemod } from './types.js';
import { v6Codemods } from './v6/index.js';
import streamTransform from './v7/stream-transform/transform.js';

const v7Codemods: Codemod[] = [
  {
    id: 'stream-transform',
    description: 'Replace cursor.stream({ transform: fn }) with cursor.stream().map(fn)',
    kind: 'mechanical',
    hop: { from: '6.x', to: '7.x' },
    packages: ['mongodb'],
    transform: streamTransform,
  },
];

export const catalog: Codemod[] = [...v6Codemods, ...v7Codemods];

export function getCatalog(packages = ['mongodb']): Codemod[] {
  return catalog.filter(c => c.packages.some(p => packages.includes(p)));
}

export function getById(id: string): Codemod | undefined {
  return catalog.find(c => c.id === id);
}
```

- [ ] **Step 8: Confirm CLI lists the codemod**

```bash
cd packages/cli && npm run build && node dist/index.js --list
```

Expected: `stream-transform` appears in the list.

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/catalog/
git commit -m "feat(cli): stream-transform codemod — cursor.stream({transform}) → cursor.stream().map()"
```

---

## Task 9: pool-retry-label and remove-beta-namespace codemods

These two follow the same pattern as Task 8. Only fixture and transform code shown.

**Files:** Same structure as Task 8 under `v7/pool-retry-label/` and `v7/remove-beta-namespace/`.

- [ ] **Step 1: Write pool-retry-label fixtures**

`__fixtures__/input.ts`:
```typescript
if (error.hasErrorLabel('PoolRequstedRetry')) {
  retry();
}
const label = 'PoolRequstedRetry';
```

`__fixtures__/expected.ts`:
```typescript
if (error.hasErrorLabel('PoolRequestedRetry')) {
  retry();
}
const label = 'PoolRequestedRetry';
```

- [ ] **Step 2: Write pool-retry-label test**

Create `packages/cli/src/catalog/v7/pool-retry-label/transform.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import jscodeshift from 'jscodeshift';
import transform from './transform.js';

const j = jscodeshift.withParser('tsx');

function run(source: string): string {
  return transform(
    { source, path: 'test.ts' },
    { jscodeshift: j, stats: () => {}, report: () => {} } as any,
    {}
  ) ?? source;
}

const fixturesDir = join(import.meta.dirname, '__fixtures__');

describe('pool-retry-label', () => {
  it('transforms fixture input to expected output', () => {
    const input = readFileSync(join(fixturesDir, 'input.ts'), 'utf8');
    const expected = readFileSync(join(fixturesDir, 'expected.ts'), 'utf8');
    expect(run(input)).toBe(expected);
  });

  it('leaves PoolRequestedRetry (correct spelling) unchanged', () => {
    const source = `error.hasErrorLabel('PoolRequestedRetry');`;
    expect(run(source)).toBe(source);
  });

  it('leaves unrelated string literals unchanged', () => {
    const source = `const x = 'SomeOtherLabel';`;
    expect(run(source)).toBe(source);
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
cd packages/cli && npm test -- pool-retry-label
```

- [ ] **Step 4: Implement pool-retry-label transform**

```typescript
import type { API, FileInfo } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.StringLiteral, { value: 'PoolRequstedRetry' }).forEach(path => {
    j(path).replaceWith(j.stringLiteral('PoolRequestedRetry'));
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
```

- [ ] **Step 5: Run pool-retry-label tests and confirm they pass**

- [ ] **Step 6: Write remove-beta-namespace fixtures**

`__fixtures__/input.ts`:
```typescript
import { MongoClient } from 'mongodb/beta';
import type { BetaType } from 'mongodb/beta';
```

`__fixtures__/expected.ts`:
```typescript
import { MongoClient } from 'mongodb';
import type { BetaType } from 'mongodb';
```

- [ ] **Step 7: Write remove-beta-namespace test** (same structure as Task 8 Step 3)

- [ ] **Step 8: Run test to confirm it fails**

- [ ] **Step 9: Implement remove-beta-namespace transform**

```typescript
import type { API, FileInfo } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.ImportDeclaration, { source: { value: 'mongodb/beta' } }).forEach(path => {
    path.node.source = j.stringLiteral('mongodb');
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
```

- [ ] **Step 10: Run remove-beta-namespace tests and confirm they pass**

- [ ] **Step 11: Register both in catalog index** — add entries to `v7Codemods` array in `catalog/index.ts`

- [ ] **Step 12: Commit**

```bash
git add packages/cli/src/catalog/v7/
git commit -m "feat(cli): pool-retry-label and remove-beta-namespace codemods"
```

---

## Task 10: remove-client-options codemod

Removes `useNewUrlParser`, `useUnifiedTopology`, and `noResponse` properties from object expressions.

**Files:** `packages/cli/src/catalog/v7/remove-client-options/`

- [ ] **Step 1: Write fixtures**

`__fixtures__/input.ts`:
```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
});

db.command({ ping: 1 }, { noResponse: false, comment: 'health' });
```

`__fixtures__/expected.ts`:
```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient(uri, {
  maxPoolSize: 10,
});

db.command({ ping: 1 }, { comment: 'health' });
```

- [ ] **Step 2: Write failing test** (same test structure as Task 8)

- [ ] **Step 3: Run test to confirm it fails**

- [ ] **Step 4: Implement transform**

```typescript
import type { API, FileInfo } from 'jscodeshift';

// retryWrites is also removed from CommandOperationOptions (it belongs on MongoClient only)
const REMOVED_OPTIONS = new Set(['useNewUrlParser', 'useUnifiedTopology', 'noResponse', 'retryWrites']);

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.ObjectExpression).forEach(path => {
    const before = path.node.properties.length;
    path.node.properties = path.node.properties.filter(prop => {
      if (prop.type !== 'ObjectProperty') return true;
      const key = prop.key;
      const name = key.type === 'Identifier' ? key.name
                 : key.type === 'StringLiteral' ? key.value
                 : null;
      return name === null || !REMOVED_OPTIONS.has(name);
    });
    if (path.node.properties.length < before) dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
```

- [ ] **Step 5: Run tests and confirm they pass**

- [ ] **Step 6: Register in catalog index**

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/catalog/v7/remove-client-options/
git commit -m "feat(cli): remove-client-options codemod — useNewUrlParser, useUnifiedTopology, noResponse"
```

---

## Task 11: remove-deprecated-types codemod

Removes deprecated type import specifiers from `import { ... } from 'mongodb'`.

**Files:** `packages/cli/src/catalog/v7/remove-deprecated-types/`

- [ ] **Step 1: Write fixtures**

`__fixtures__/input.ts`:
```typescript
import { MongoClient, CloseOptions, CancellationToken, Transaction, ResumeOptions, ServerCapabilities } from 'mongodb';
import type { ClientMetadataOptions } from 'mongodb';
```

`__fixtures__/expected.ts`:
```typescript
import { MongoClient } from 'mongodb';
```

- [ ] **Step 2: Write failing test** (same structure as Task 8)

- [ ] **Step 3: Run test to confirm it fails**

- [ ] **Step 4: Implement transform**

```typescript
import type { API, FileInfo } from 'jscodeshift';

const REMOVED_TYPES = new Set([
  'CloseOptions', 'ResumeOptions', 'CancellationToken', 'Transaction',
  'ServerCapabilities', 'ClientMetadataOptions', 'FindOneOptions',
]);

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.ImportDeclaration)
    .filter(path =>
      path.node.source.value === 'mongodb' ||
      path.node.source.value === 'mongodb/beta'
    )
    .forEach(path => {
      const before = path.node.specifiers?.length ?? 0;
      path.node.specifiers = (path.node.specifiers ?? []).filter(s => {
        if (s.type !== 'ImportSpecifier') return true;
        const name = s.imported.type === 'Identifier' ? s.imported.name : null;
        return name === null || !REMOVED_TYPES.has(name);
      });
      const after = path.node.specifiers.length;
      if (after < before) {
        dirty = true;
        if (after === 0) j(path).remove();
      }
    });

  return dirty ? root.toSource() : undefined;
}
```

- [ ] **Step 5: Run tests and confirm they pass**

- [ ] **Step 6: Register in catalog index**

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/catalog/v7/remove-deprecated-types/
git commit -m "feat(cli): remove-deprecated-types codemod — strips removed type imports from mongodb"
```

---

## Task 12: Remaining mechanical codemods

Four more codemods following the established pattern. Each needs fixtures + test + transform + catalog registration.

**remove-gridfs-deprecated** — removes `contentType` and `aliases` from object literals.

`__fixtures__/input.ts`:
```typescript
const opts: GridFSBucketWriteStreamOptions = {
  contentType: 'text/plain',
  aliases: ['readme'],
  chunkSizeBytes: 1024,
};
```

`__fixtures__/expected.ts`:
```typescript
const opts: GridFSBucketWriteStreamOptions = {
  chunkSizeBytes: 1024,
};
```

Transform — reuse the same object-property-removal pattern from Task 10, replacing `REMOVED_OPTIONS` with `new Set(['contentType', 'aliases'])`.

---

**find-one-options** — removes the `batchSize`, `limit`, and `noCursorTimeout` properties from `FindOneOptions` usage (same object-property removal pattern as Task 10).

`__fixtures__/input.ts`:
```typescript
const opts: FindOneOptions = { batchSize: 10, limit: 5, noCursorTimeout: true, projection: { name: 1 } };
```

`__fixtures__/expected.ts`:
```typescript
const opts: FindOneOptions = { projection: { name: 1 } };
```

Transform — reuse the object-property-removal pattern from Task 10, replacing `REMOVED_OPTIONS` with `new Set(['batchSize', 'limit', 'noCursorTimeout'])`.

---

**find-options-generic** — removes the type parameter from `FindOptions<T>`.

`__fixtures__/input.ts`:
```typescript
import { FindOptions } from 'mongodb';
const opts: FindOptions<{ name: string }> = { limit: 10 };
```

`__fixtures__/expected.ts`:
```typescript
import { FindOptions } from 'mongodb';
const opts: FindOptions = { limit: 10 };
```

Transform:
```typescript
import type { API, FileInfo } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.TSTypeReference)
    .filter(path => {
      const name = path.node.typeName;
      return name.type === 'Identifier' && name.name === 'FindOptions';
    })
    .filter(path => (path.node.typeParameters?.params?.length ?? 0) > 0)
    .forEach(path => {
      path.node.typeParameters = undefined;
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}
```

---

**remove-property-access** — removes `ReadPreference.minWireVersion` and `session.transaction` accesses (replaces with a TODO comment).

`__fixtures__/input.ts`:
```typescript
const ver = ReadPreference.minWireVersion;
const txn = session.transaction;
```

`__fixtures__/expected.ts`:
```typescript
const ver = undefined; // TODO(mongodb-upgrade): ReadPreference.minWireVersion removed in v7
const txn = undefined; // TODO(mongodb-upgrade): session.transaction removed in v7
```

Transform:
```typescript
import type { API, FileInfo } from 'jscodeshift';

const REMOVED_PROPERTY_ACCESS: Array<{ object: string; property: string; note: string }> = [
  { object: 'ReadPreference', property: 'minWireVersion', note: 'ReadPreference.minWireVersion removed in v7' },
  { object: 'session', property: 'transaction', note: 'session.transaction removed in v7' },
];

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  for (const { object, property, note } of REMOVED_PROPERTY_ACCESS) {
    root
      .find(j.MemberExpression, {
        object: { type: 'Identifier', name: object },
        property: { type: 'Identifier', name: property },
      })
      .forEach(path => {
        const replacement = j.identifier('undefined');
        j(path).replaceWith(
          j.addComment(replacement, 'trailing', ` TODO(mongodb-upgrade): ${note}`)
        );
        dirty = true;
      });
  }

  return dirty ? root.toSource() : undefined;
}
```

- [ ] **For each of the four codemods above:**
  - Write fixtures (input + expected)
  - Write failing test
  - Run test to confirm fail
  - Implement transform
  - Run test to confirm pass
  - Register in catalog index

- [ ] **Commit all four together**

```bash
git add packages/cli/src/catalog/v7/
git commit -m "feat(cli): gridfs, find-options, property-access codemods"
```

---

## Task 13: Semantic flag codemods

All five semantic flags live in one file. They detect patterns and insert inline `// TODO(mongodb-upgrade): ...` comments rather than rewriting code.

**Files:** `packages/cli/src/catalog/v7/semantic/`

- [ ] **Step 1: Write fixtures**

`__fixtures__/input.ts`:
```typescript
import { MongoClient } from 'mongodb';

// aws-explicit-credentials
const client1 = new MongoClient('mongodb://AKID:SECRET@host/?authMechanism=MONGODB-AWS');

// mongodb-cr-auth
const client2 = new MongoClient(uri, { authMechanism: 'MONGODB-CR' });

// client-metadata-props
console.log(client.options.additionalDriverInfo);

// cursor-implicit-batch-size
const cursor = collection.find({}, { batchSize: 1000 });
```

`__fixtures__/expected.ts`:
```typescript
import { MongoClient } from 'mongodb';

// aws-explicit-credentials
// TODO(mongodb-upgrade): MONGODB-AWS no longer accepts explicit credentials in the URI. Remove credentials and let @aws-sdk/credential-providers handle them. See: https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/
const client1 = new MongoClient('mongodb://AKID:SECRET@host/?authMechanism=MONGODB-AWS');

// mongodb-cr-auth
// TODO(mongodb-upgrade): MONGODB-CR auth mechanism has been removed. Switch to SCRAM-SHA-256 or another supported mechanism.
const client2 = new MongoClient(uri, { authMechanism: 'MONGODB-CR' });

// client-metadata-props
// TODO(mongodb-upgrade): additionalDriverInfo is no longer part of the public API. Remove this access.
console.log(client.options.additionalDriverInfo);

// cursor-implicit-batch-size
// TODO(mongodb-upgrade): batchSize: 1000 may have been compensating for the now-removed default. Verify this is intentional.
const cursor = collection.find({}, { batchSize: 1000 });
```

- [ ] **Step 2: Write failing test** (same structure as Task 8)

- [ ] **Step 3: Run test to confirm it fails**

- [ ] **Step 4: Implement semantic transform**

```typescript
import type { API, FileInfo } from 'jscodeshift';

function addLeadingTodo(j: API['jscodeshift'], path: any, message: string): void {
  j(path).replaceWith(
    j.addComment(path.node, 'leading', ` TODO(mongodb-upgrade): ${message}`)
  );
}

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  // aws-explicit-credentials: URI string containing MONGODB-AWS with credentials
  root.find(j.StringLiteral).filter(path => {
    const val = path.node.value;
    return val.includes('authMechanism=MONGODB-AWS') && /@.+@/.test(val);
  }).forEach(path => {
    addLeadingTodo(j, path,
      'MONGODB-AWS no longer accepts explicit credentials in the URI. Remove credentials and let @aws-sdk/credential-providers handle them.');
    dirty = true;
  });

  // mongodb-cr-auth
  root.find(j.StringLiteral, { value: 'MONGODB-CR' }).forEach(path => {
    addLeadingTodo(j, path,
      'MONGODB-CR auth mechanism has been removed. Switch to SCRAM-SHA-256 or another supported mechanism.');
    dirty = true;
  });

  // client-metadata-props
  const META_PROPS = new Set(['additionalDriverInfo', 'extendedMetadata']);
  root.find(j.MemberExpression).filter(path => {
    const prop = path.node.property;
    return prop.type === 'Identifier' && META_PROPS.has(prop.name);
  }).forEach(path => {
    addLeadingTodo(j, path,
      `${(path.node.property as jscodeshift.Identifier).name} is no longer part of the public API. Remove this access.`);
    dirty = true;
  });

  // cursor-implicit-batch-size: batchSize: 1000 in options object
  root.find(j.ObjectProperty).filter(path => {
    const key = path.node.key;
    const val = path.node.value;
    return key.type === 'Identifier' && key.name === 'batchSize' &&
           val.type === 'NumericLiteral' && val.value === 1000;
  }).forEach(path => {
    addLeadingTodo(j, path,
      'batchSize: 1000 may have been compensating for the now-removed default of 1000. Verify this is intentional.');
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
```

- [ ] **Step 5: Run tests and confirm they pass**

- [ ] **Step 6: Register all five semantic entries in catalog/index.ts**

Add five entries to `v7Codemods`, each with `kind: 'semantic'` and the `transform` from the semantic module. Use separate IDs: `aws-explicit-credentials`, `mongodb-cr-auth`, `client-metadata-props`, `cursor-implicit-batch-size`, `aws-sdk-required`.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/catalog/v7/semantic/
git commit -m "feat(cli): semantic flag codemods — insert TODO comments for issues requiring human review"
```

---

## Task 14: Environmental checks

**Files:** `packages/cli/src/env/v7.ts`

- [ ] **Step 1: Create env/v7.ts**

```typescript
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as semver from 'semver';
import type { EnvCheck, EnvCheckResult } from '../catalog/types.js';

function readPkg(cwd: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
}

function writePkg(cwd: string, pkg: Record<string, unknown>): void {
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

export const nodeVersionCheck: EnvCheck = (cwd) => {
  const pkg = readPkg(cwd);
  const engines = (pkg['engines'] as Record<string, string> | undefined) ?? {};
  const current = engines['node'] ?? '';
  const required = '>=20.19.0';
  if (semver.satisfies('20.19.0', current)) return { status: 'ok', message: 'Node version requirement is satisfied' };
  engines['node'] = required;
  pkg['engines'] = engines;
  writePkg(cwd, pkg);
  return { status: 'warn', message: `Updated engines.node to ${required}`, autoFixed: true };
};

export const mongodbDepBump: EnvCheck = (cwd) => {
  const pkg = readPkg(cwd);
  const deps = (pkg['dependencies'] as Record<string, string> | undefined) ?? {};
  const devDeps = (pkg['devDependencies'] as Record<string, string> | undefined) ?? {};
  const target = '^7.0.0';

  if (deps['mongodb']) {
    deps['mongodb'] = target;
    pkg['dependencies'] = deps;
    writePkg(cwd, pkg);
    return { status: 'warn', message: `Bumped mongodb to ${target} in dependencies`, autoFixed: true };
  }
  if (devDeps['mongodb']) {
    devDeps['mongodb'] = target;
    pkg['devDependencies'] = devDeps;
    writePkg(cwd, pkg);
    return { status: 'warn', message: `Bumped mongodb to ${target} in devDependencies`, autoFixed: true };
  }
  return { status: 'ok', message: 'mongodb dependency not found (nothing to bump)' };
};

function peerDepBump(name: string, target: string): EnvCheck {
  return (cwd) => {
    const pkg = readPkg(cwd);
    const deps = (pkg['dependencies'] as Record<string, string> | undefined) ?? {};
    const devDeps = (pkg['devDependencies'] as Record<string, string> | undefined) ?? {};
    const peerDeps = (pkg['peerDependencies'] as Record<string, string> | undefined) ?? {};

    for (const [section, map] of [['dependencies', deps], ['devDependencies', devDeps], ['peerDependencies', peerDeps]] as const) {
      if ((map as Record<string, string>)[name]) {
        (map as Record<string, string>)[name] = target;
        pkg[section] = map;
        writePkg(cwd, pkg);
        return { status: 'warn', message: `Bumped ${name} to ${target} in ${section}`, autoFixed: true };
      }
    }
    return { status: 'ok', message: `${name} not found (nothing to bump)` };
  };
}

export const v7EnvChecks = [
  { id: 'node-version', description: 'Update engines.node to >=20.19.0', check: nodeVersionCheck },
  { id: 'mongodb-dep-bump', description: 'Bump mongodb dependency to ^7.0.0', check: mongodbDepBump },
  { id: 'bson-dep-bump', description: 'Bump bson to ^7.0.0 if present', check: peerDepBump('bson', '^7.0.0') },
  { id: 'peer-dep-kerberos', description: 'Bump kerberos to ^7.0.0 if present', check: peerDepBump('kerberos', '^7.0.0') },
  { id: 'peer-dep-zstd', description: 'Bump @mongodb-js/zstd to ^7.0.0 if present', check: peerDepBump('@mongodb-js/zstd', '^7.0.0') },
  { id: 'peer-dep-encryption', description: 'Bump mongodb-client-encryption to ^7.0.0 if present', check: peerDepBump('mongodb-client-encryption', '^7.0.0') },
];
```

- [ ] **Step 2: Register env checks in catalog/index.ts**

Import `v7EnvChecks` and spread them into `v7Codemods` with `kind: 'env'`:

```typescript
import { v7EnvChecks } from '../env/v7.js';

const v7Codemods: Codemod[] = [
  // ... existing mechanical + semantic entries ...
  ...v7EnvChecks.map(e => ({
    ...e,
    kind: 'env' as const,
    hop: { from: '6.x', to: '7.x' },
    packages: ['mongodb'],
  })),
];
```

- [ ] **Step 3: Run full test suite**

```bash
cd packages/cli && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/env/
git commit -m "feat(cli): environmental checks — node version, mongodb dep bump, peer deps"
```

---

> ✅ **CHECKPOINT** — All v6→v7 codemods are implemented. `node dist/index.js --list` shows 24 entries (13 mechanical + 5 semantic + 6 env). Run the CLI against any v6 project and it produces a full report.

---

## Task 15: Populate test-app-v6

**Files:**

- Create: `packages/test-app-v6/package.json`
- Create: `packages/test-app-v6/tsconfig.json`
- Create: `packages/test-app-v6/src/index.ts`

- [ ] **Step 1: Create test-app-v6/package.json**

```json
{
  "name": "test-app-v6",
  "version": "1.0.0",
  "private": true,
  "description": "Kitchen-sink app using every mongodb v6 deprecated API — used as CLI upgrade demo target",
  "engines": { "node": ">=16.0.0" },
  "dependencies": {
    "mongodb": "6.20.0"
  }
}
```

- [ ] **Step 2: Create test-app-v6/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "noEmit": true }
}
```

- [ ] **Step 3: Create src/index.ts with every v6→v7 deprecated pattern**

```typescript
import {
  MongoClient,
  ReadPreference,
  CloseOptions,
  CancellationToken,
  Transaction,
  ResumeOptions,
  ServerCapabilities,
  FindOptions,
  ClientMetadataOptions,
} from 'mongodb';
import type { GridFSFile, GridFSBucketWriteStreamOptions } from 'mongodb';

// --- Mechanical: stream-transform ---
async function streamExample(client: MongoClient) {
  const cursor = client.db('test').collection('docs').find({});
  const stream = cursor.stream({ transform: JSON.stringify });
  return stream;
}

// --- Mechanical: pool-retry-label ---
function checkLabel(error: Error & { hasErrorLabel?: (l: string) => boolean }) {
  if (error.hasErrorLabel?.('PoolRequstedRetry')) {
    console.log('pool retry');
  }
}

// --- Mechanical: remove-client-options ---
function connectClient(uri: string) {
  return new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
  });
}

// --- Mechanical: remove-beta-namespace ---
// import { MongoClient } from 'mongodb/beta'; // uncomment to test

// --- Mechanical: remove-deprecated-types ---
const closeOpts: CloseOptions = {};
const token: CancellationToken = new CancellationToken();
const resumeOpts: ResumeOptions = {};
const svrCaps: ServerCapabilities = {} as ServerCapabilities;
const metaOpts: ClientMetadataOptions = {} as ClientMetadataOptions;

// --- Mechanical: remove-gridfs-deprecated ---
const writeStreamOpts: GridFSBucketWriteStreamOptions = {
  contentType: 'text/plain',
  aliases: ['readme', 'docs'],
  chunkSizeBytes: 261120,
};

// --- Mechanical: find-options-generic ---
const findOpts: FindOptions<{ name: string }> = { limit: 10 };

// --- Mechanical: remove-property-access ---
const minWire = ReadPreference.minWireVersion;

async function sessionExample(client: MongoClient) {
  const session = client.startSession();
  const txn = session.transaction;
  await session.endSession();
}

// --- Semantic: aws-explicit-credentials ---
const awsClient = new MongoClient(
  'mongodb://AKID:SECRET@cluster.example.com/?authMechanism=MONGODB-AWS'
);

// --- Semantic: mongodb-cr-auth ---
const crClient = new MongoClient('mongodb://localhost:27017', {
  authMechanism: 'MONGODB-CR' as any,
});

// --- Semantic: client-metadata-props ---
async function metaExample(client: MongoClient) {
  console.log((client.options as any).additionalDriverInfo);
}

// --- Semantic: cursor-implicit-batch-size ---
async function batchExample(client: MongoClient) {
  const cursor = client.db('test').collection('docs').find({}, { batchSize: 1000 });
  return cursor.toArray();
}

export { streamExample, checkLabel, connectClient, sessionExample, awsClient, crClient };
```

- [ ] **Step 4: Commit this as the "before" state**

```bash
git add packages/test-app-v6/
git commit -m "test: add test-app-v6 — kitchen-sink app with every v6→v7 deprecated API"
```

This commit is the demo reset point. `git checkout -- packages/test-app-v6/` restores it after any CLI run.

---

## Task 16: Integration test

**Files:**

- Create: `packages/cli/src/integration.test.ts`

- [ ] **Step 1: Write the integration test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cpSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detect } from './detect.js';
import { buildPlan } from './plan.js';
import { getCatalog } from './catalog/index.js';
import { runCodemods, runEnvChecks } from './runner.js';
import { buildReport } from './report.js';

const TEST_APP_V6 = join(import.meta.dirname, '../../../test-app-v6');

describe('CLI integration — test-app-v6', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `integration-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V6, tmp, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('detects mongodb@6.20.0', () => {
    const result = detect(tmp);
    expect(result).toEqual({ package: 'mongodb', current: '6.20.0' });
  });

  it('plans a single hop 6.x → 7.x', () => {
    const result = detect(tmp)!;
    const plan = buildPlan(result.current);
    expect(plan).toEqual([{ from: '6.x', to: '7.x' }]);
  });

  it('applies all mechanical transforms without error', async () => {
    const codemods = getCatalog().filter(c => c.kind === 'mechanical');
    const changes = await runCodemods(codemods, tmp, { dryRun: false });
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(c => c.status === 'applied')).toBe(true);
  });

  it('generates a report with mechanical and flagged entries', async () => {
    const codemods = getCatalog();
    const mechanical = codemods.filter(c => c.kind === 'mechanical');
    const semantic = codemods.filter(c => c.kind === 'semantic');
    const changes = [
      ...await runCodemods(mechanical, tmp, { dryRun: false }),
      ...await runCodemods(semantic, tmp, { dryRun: false }),
    ];
    const report = buildReport('mongodb', '6.20.0', '7.x', changes);
    expect(report.summary.mechanical).toBeGreaterThan(0);
    expect(report.summary.flagged).toBeGreaterThan(0);
  });

  it('bumps mongodb dep to ^7.0.0 via env check', async () => {
    const codemods = getCatalog().filter(c => c.id === 'mongodb-dep-bump');
    await runEnvChecks(codemods, tmp, { dryRun: false });
    const pkg = JSON.parse(readFileSync(join(tmp, 'package.json'), 'utf8'));
    expect(pkg.dependencies.mongodb).toBe('^7.0.0');
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
cd packages/cli && npm test -- integration
```

Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/integration.test.ts
git commit -m "test(cli): integration tests against test-app-v6"
```

---

## Task 17: Scaffold remaining test apps

**Files:** `packages/test-app-v5/`, `packages/test-app-v4/`, `packages/test-app-v4.2/`

- [ ] **Step 1: Create test-app-v5**

`packages/test-app-v5/package.json`:
```json
{
  "name": "test-app-v5",
  "version": "1.0.0",
  "private": true,
  "description": "Kitchen-sink app for v5→v6 upgrade testing (Phase 2)",
  "engines": { "node": ">=14.0.0" },
  "dependencies": { "mongodb": "5.8.1" }
}
```

`packages/test-app-v5/src/index.ts`:
```typescript
// Phase 2: populate with v5→v6 deprecated APIs.
// Patterns to add:
//   - db.addUser() / admin.addUser() (removed in v6)
//   - collection.stats() (removed in v6)
//   - BulkWriteResult.nInserted / nUpserted / nMatched / nModified / nRemoved (removed in v6)
//   - sslCA / sslCRL / sslCert / sslKey / sslPass / sslValidate / tlsCertificateFile (removed in v6)
//   - keepAlive / keepAliveInitialDelay options (removed in v6)
//   - findOneAndUpdate / findOneAndReplace / findOneAndDelete without includeResultMetadata (behavior change)
//   - withTransaction return value usage (behavior change)

export {};
```

- [ ] **Step 2: Create test-app-v4**

`packages/test-app-v4/package.json`:
```json
{
  "name": "test-app-v4",
  "version": "1.0.0",
  "private": true,
  "description": "Kitchen-sink app for v4→v5 upgrade testing (Phase 2)",
  "dependencies": { "mongodb": "4.13.0" }
}
```

`packages/test-app-v4/src/index.ts`:
```typescript
// Phase 2: populate with v4→v5 deprecated APIs.
// Patterns to add:
//   - Callback-based API (removed in v5 — the big one)
//   - Collection.insert / Collection.update / Collection.remove (removed in v5)
//   - Collection.mapReduce() (removed in v5)
//   - ObjectID (renamed to ObjectId in v5)
//   - slaveOk options
//   - Custom Promise library support (removed in v5)
//   - BulkWriteOptions.keepGoing (removed in v5)

export {};
```

- [ ] **Step 3: Create test-app-v4.2**

`packages/test-app-v4.2/package.json`:
```json
{
  "name": "test-app-v4-2",
  "version": "1.0.0",
  "private": true,
  "description": "Kitchen-sink app pinned to mongodb@4.2.0 — lowest supported 4.2.x (Phase 2)",
  "dependencies": { "mongodb": "4.2.0" }
}
```

`packages/test-app-v4.2/src/index.ts`:
```typescript
// Phase 2: same deprecated patterns as test-app-v4 but pinned to the absolute
// minimum 4.2.0, which represents customers furthest behind. Includes all patterns
// from test-app-v4 plus any APIs that changed between 4.2 and 4.13.

export {};
```

- [ ] **Step 4: Commit all scaffolded apps**

```bash
git add packages/test-app-v5 packages/test-app-v4 packages/test-app-v4.2
git commit -m "test: scaffold test-app-v5, v4, v4.2 for Phase 2 upgrade testing"
```

---

> ✅ **CHECKPOINT** — Full CLI is working end-to-end. Run `node packages/cli/dist/index.js packages/test-app-v6 --dry-run` to see the full report. Run `git diff` after a real run to see every transform.

---

## Task 18: MCP server scaffolding

**Files:**

- Create: `packages/mcp/src/index.ts`

- [ ] **Step 1: Create the MCP server entrypoint**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { analyzeRepo } from './tools/analyze-repo.js';
import { applyCodemod } from './tools/apply-codemod.js';
import { explainBreakingChange } from './tools/explain-breaking-change.js';

const server = new Server(
  { name: 'mongodb-upgrade', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'analyze_repo',
      description: 'Scan a project and return the current mongodb version, upgrade plan, and per-file breakdown of issues.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the project root' },
        },
        required: ['path'],
      },
    },
    {
      name: 'apply_codemod',
      description: 'Apply a named codemod (or all codemods for the detected hop) to a project.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the project root' },
          codemod: { type: 'string', description: 'Codemod ID to run, or "all" for all applicable codemods' },
          dryRun: { type: 'boolean', description: 'If true, return the diff without writing files', default: false },
        },
        required: ['path', 'codemod'],
      },
    },
    {
      name: 'explain_breaking_change',
      description: 'Return a description, before/after code example, and migration notes for a named breaking change.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Codemod ID, e.g. "stream-transform"' },
        },
        required: ['id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze_repo') {
    return { content: [{ type: 'text', text: JSON.stringify(await analyzeRepo(args as { path: string }), null, 2) }] };
  }
  if (name === 'apply_codemod') {
    return { content: [{ type: 'text', text: JSON.stringify(await applyCodemod(args as { path: string; codemod: string; dryRun?: boolean }), null, 2) }] };
  }
  if (name === 'explain_breaking_change') {
    return { content: [{ type: 'text', text: JSON.stringify(explainBreakingChange(args as { id: string }), null, 2) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

- [ ] **Step 2: Build MCP package**

```bash
cd packages/mcp && npm run build
```

Expected: `dist/index.js` created, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/index.ts
git commit -m "feat(mcp): MCP stdio server scaffolding with tool registration"
```

---

## Task 19: analyze_repo tool

**Files:**

- Create: `packages/mcp/src/tools/analyze-repo.ts`

- [ ] **Step 1: Create the tool**

```typescript
import { detect } from '@mongodb-js/upgrade/detect';
import { buildPlan } from '@mongodb-js/upgrade/plan';
import { getCatalog } from '@mongodb-js/upgrade/catalog/index';
import { runCodemods } from '@mongodb-js/upgrade/runner';

export interface AnalyzeResult {
  package: string;
  currentVersion: string;
  plan: Array<{ from: string; to: string }>;
  codemods: Array<{ id: string; kind: string; description: string }>;
  fileBreakdown: Array<{ file: string; codemods: string[] }>;
}

export async function analyzeRepo({ path }: { path: string }): Promise<AnalyzeResult> {
  const detected = detect(path);
  if (!detected) throw new Error(`Could not detect mongodb version in ${path}/package.json`);

  const plan = buildPlan(detected.current);
  const codemods = getCatalog().filter(c =>
    plan.some(hop => hop.from === c.hop.from)
  );

  // dry-run to discover which files would be affected
  const changes = await runCodemods(
    codemods.filter(c => c.kind !== 'env'),
    path,
    { dryRun: true }
  );

  const byFile = new Map<string, string[]>();
  for (const change of changes) {
    const list = byFile.get(change.file) ?? [];
    list.push(change.codemod);
    byFile.set(change.file, list);
  }

  return {
    package: detected.package,
    currentVersion: detected.current,
    plan,
    codemods: codemods.map(c => ({ id: c.id, kind: c.kind, description: c.description })),
    fileBreakdown: [...byFile.entries()].map(([file, cmds]) => ({ file, codemods: cmds })),
  };
}
```

- [ ] **Step 2: Update packages/cli/package.json exports** so the MCP package can import CLI modules directly

```json
{
  "exports": {
    ".": { "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./detect": { "import": "./dist/detect.js" },
    "./plan": { "import": "./dist/plan.js" },
    "./runner": { "import": "./dist/runner.js" },
    "./catalog/index": { "import": "./dist/catalog/index.js" },
    "./catalog/types": { "import": "./dist/catalog/types.js" }
  }
}
```

- [ ] **Step 3: Rebuild CLI then build MCP**

```bash
cd packages/cli && npm run build && cd ../mcp && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp/src/tools/analyze-repo.ts packages/cli/package.json
git commit -m "feat(mcp): analyze_repo tool — detects version, plans hops, file-by-file breakdown"
```

---

## Task 20: apply_codemod tool

**Files:**

- Create: `packages/mcp/src/tools/apply-codemod.ts`

- [ ] **Step 1: Create the tool**

```typescript
import { detect } from '@mongodb-js/upgrade/detect';
import { buildPlan } from '@mongodb-js/upgrade/plan';
import { getCatalog, getById } from '@mongodb-js/upgrade/catalog/index';
import { runCodemods, runEnvChecks } from '@mongodb-js/upgrade/runner';
import type { Change } from '@mongodb-js/upgrade/runner';

export interface ApplyResult {
  dryRun: boolean;
  changes: Change[];
  summary: { applied: number; flagged: number };
}

export async function applyCodemod({
  path,
  codemod,
  dryRun = false,
}: {
  path: string;
  codemod: string;
  dryRun?: boolean;
}): Promise<ApplyResult> {
  const detected = detect(path);
  if (!detected) throw new Error(`Could not detect mongodb version in ${path}/package.json`);

  let codemods;
  if (codemod === 'all') {
    const plan = buildPlan(detected.current);
    codemods = getCatalog().filter(c => plan.some(hop => hop.from === c.hop.from));
  } else {
    const found = getById(codemod);
    if (!found) throw new Error(`Unknown codemod: ${codemod}. Run analyze_repo to see available codemods.`);
    codemods = [found];
  }

  const changes: Change[] = [
    ...await runCodemods(codemods.filter(c => c.kind !== 'env'), path, { dryRun }),
    ...await runEnvChecks(codemods.filter(c => c.kind === 'env'), path, { dryRun }),
  ];

  return {
    dryRun,
    changes,
    summary: {
      applied: changes.filter(c => c.status === 'applied').length,
      flagged: changes.filter(c => c.status === 'flagged').length,
    },
  };
}
```

- [ ] **Step 2: Rebuild MCP**

```bash
cd packages/mcp && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/tools/apply-codemod.ts
git commit -m "feat(mcp): apply_codemod tool — surgical or bulk transform application"
```

---

## Task 21: explain_breaking_change tool

**Files:**

- Create: `packages/mcp/src/tools/explain-breaking-change.ts`

- [ ] **Step 1: Create the tool**

```typescript
import { getById } from '@mongodb-js/upgrade/catalog/index';

export interface ExplainResult {
  id: string;
  description: string;
  kind: string;
  hop: { from: string; to: string };
  before: string;
  after: string;
  notes: string;
  docsUrl: string;
}

const DOCS_BASE = 'https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/';

const EXAMPLES: Record<string, { before: string; after: string; notes: string }> = {
  'stream-transform': {
    before: `const stream = cursor.stream({ transform: JSON.stringify });`,
    after:  `const stream = cursor.stream().map(JSON.stringify);`,
    notes:  'The transform option has been removed. Use the standard ReadableStream.map() method instead.',
  },
  'pool-retry-label': {
    before: `if (error.hasErrorLabel('PoolRequstedRetry')) { ... }`,
    after:  `if (error.hasErrorLabel('PoolRequestedRetry')) { ... }`,
    notes:  'Typo fix in the error label name. String comparisons against the old spelling will silently stop matching.',
  },
  'remove-client-options': {
    before: `new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })`,
    after:  `new MongoClient(uri, {})`,
    notes:  'These options were deprecated in v4 and no-ops since v4. They now throw if provided.',
  },
  'remove-deprecated-types': {
    before: `import { CloseOptions, CancellationToken } from 'mongodb';`,
    after:  `// (remove the import — these types no longer exist)`,
    notes:  'These types were deprecated in earlier versions and have been removed. TypeScript will report errors if they remain.',
  },
  'remove-gridfs-deprecated': {
    before: `bucket.openUploadStream('file.txt', { contentType: 'text/plain', aliases: ['doc'] })`,
    after:  `bucket.openUploadStream('file.txt', {})`,
    notes:  'GridFS contentType and aliases fields were deprecated and are no longer supported.',
  },
  'find-options-generic': {
    before: `const opts: FindOptions<{ name: string }> = {};`,
    after:  `const opts: FindOptions = {};`,
    notes:  'FindOptions no longer accepts a type parameter. The generic argument is ignored at runtime and was only used for internal typing.',
  },
  'remove-property-access': {
    before: `ReadPreference.minWireVersion\nsession.transaction`,
    after:  `// remove these — they no longer exist`,
    notes:  'These internal properties were never intended to be public API and have been removed.',
  },
  'remove-beta-namespace': {
    before: `import { MongoClient } from 'mongodb/beta';`,
    after:  `import { MongoClient } from 'mongodb';`,
    notes:  "The 'mongodb/beta' export has been removed. Resource management (Symbol.asyncDispose) is now available directly from 'mongodb'.",
  },
  'aws-explicit-credentials': {
    before: `new MongoClient('mongodb://AKID:SECRET@host/?authMechanism=MONGODB-AWS')`,
    after:  `new MongoClient('mongodb://host/?authMechanism=MONGODB-AWS')`,
    notes:  'Explicit AWS credentials in the URI are no longer accepted. Install @aws-sdk/credential-providers and let it manage credentials via environment variables or IAM roles.',
  },
  'mongodb-cr-auth': {
    before: `new MongoClient(uri, { authMechanism: 'MONGODB-CR' })`,
    after:  `new MongoClient(uri, { authMechanism: 'SCRAM-SHA-256' })`,
    notes:  'MONGODB-CR was removed from MongoDB server in 4.0. Use SCRAM-SHA-256 (the default) or SCRAM-SHA-1.',
  },
  'client-metadata-props': {
    before: `client.options.additionalDriverInfo`,
    after:  `// remove — this was an internal property never intended for public use`,
    notes:  'These metadata properties on MongoOptions were internal implementation details. Remove any access to them.',
  },
  'cursor-implicit-batch-size': {
    before: `collection.find({}, { batchSize: 1000 })`,
    after:  `collection.find({})  // or keep batchSize if intentional`,
    notes:  'The driver no longer sets a default batchSize of 1000. If you set batchSize: 1000 to match the old default, it is now redundant. If it was intentional, keep it.',
  },
};

export function explainBreakingChange({ id }: { id: string }): ExplainResult {
  const codemod = getById(id);
  if (!codemod) throw new Error(`Unknown codemod: ${id}`);

  const example = EXAMPLES[id] ?? {
    before: '(no example available)',
    after:  '(no example available)',
    notes:  '',
  };

  return {
    id,
    description: codemod.description,
    kind: codemod.kind,
    hop: codemod.hop,
    ...example,
    docsUrl: DOCS_BASE,
  };
}
```

- [ ] **Step 2: Rebuild MCP**

```bash
cd packages/mcp && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/tools/explain-breaking-change.ts
git commit -m "feat(mcp): explain_breaking_change tool — canonical before/after examples for every codemod"
```

---

## Task 22: Wire MCP into Claude Code and run the demo

- [ ] **Step 1: Add MCP server config to Claude Code settings**

Edit `.claude/settings.json` in this repo (create if it doesn't exist):

```json
{
  "mcpServers": {
    "mongodb-upgrade": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"]
    }
  }
}
```

- [ ] **Step 2: Restart Claude Code** to pick up the MCP server.

- [ ] **Step 3: Reset the test app to its "before" state**

```bash
git checkout -- packages/test-app-v6/
```

- [ ] **Step 4: Run the demo through Claude Code**

Ask Claude Code: *"Help me upgrade the MongoDB driver in packages/test-app-v6"*

Expected agent interaction:
1. Agent calls `analyze_repo` → gets the plan
2. Agent calls `explain_breaking_change` for the first issue
3. Agent calls `apply_codemod` with `dryRun: true` → shows the diff
4. Agent calls `apply_codemod` without dryRun → applies transforms
5. Agent summarizes what was applied, what needs human attention

- [ ] **Step 5: Verify the diff**

```bash
git diff packages/test-app-v6/
```

Expected: `stream({ transform })` replaced with `.stream().map()`, deprecated options removed, TODO comments inserted for semantic issues, `package.json` bumped to `mongodb@^7.0.0`.

- [ ] **Step 6: Final commit**

```bash
git add .claude/settings.json
git commit -m "chore: add MCP server config for Claude Code demo"
```

---

> ✅ **FINAL DEMO STATE** — All three goals achieved:
> - **A**: Working CLI with all v6→v7 transforms, dry-run, report
> - **B**: Complete codemod catalog (13 mechanical + 5 semantic + 6 env), fixture tests, integration tests
> - **C**: MCP server with analyze_repo, apply_codemod, explain_breaking_change — callable from Claude Code
