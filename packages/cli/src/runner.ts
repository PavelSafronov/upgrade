import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import jscodeshift, { type API } from 'jscodeshift';
import type { Codemod, EnvCheckResult } from './catalog/types.js';

export interface Change {
  codemod: string;
  file: string;
  status: 'applied' | 'flagged' | 'nothing-to-do';
  kind: 'mechanical' | 'semantic' | 'env';
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
    ignore: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'out/**',
      '.next/**',
      'coverage/**',
      '*-dist/**',
      '*.min.js',
      '*.d.ts',
    ],
    absolute: false,
  });

  const changes: Change[] = [];
  const parseErrors = new Set<string>();

  for (const codemod of codemods) {
    if (codemod.kind === 'env') continue;

    for (const relPath of files) {
      if (parseErrors.has(relPath)) continue;

      const absPath = join(cwd, relPath);
      const source = readFileSync(absPath, 'utf8');

      const fakeApi = { jscodeshift: j, j, stats: () => {}, report: () => {} } as unknown as API;
      let result: string | null | undefined;
      try {
        result = codemod.transform!(
          { source, path: relPath },
          fakeApi,
          {}
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
        process.stderr.write(`  ⚠ parse error, skipping ${relPath}: ${msg}\n`);
        parseErrors.add(relPath);
        continue;
      }

      if (result != null && result !== source) {
        if (!opts.dryRun) writeFileSync(absPath, result, 'utf8');
        const status = codemod.kind === 'semantic' ? 'flagged' : 'applied';
        changes.push({ codemod: codemod.id, file: relPath, status, kind: codemod.kind as 'mechanical' | 'semantic' });
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
    const pkgPath = join(cwd, 'package.json');
    const backup = opts.dryRun && existsSync(pkgPath) ? readFileSync(pkgPath, 'utf8') : null;
    let result: EnvCheckResult | undefined;
    try {
      result = codemod.check!(cwd);
    } finally {
      if (backup !== null) writeFileSync(pkgPath, backup, 'utf8');
    }
    if (result!.status !== 'ok') {
      changes.push({
        codemod: codemod.id,
        file: 'package.json',
        status: result!.autoFixed && !opts.dryRun ? 'applied' : 'flagged',
        kind: 'env',
        note: result!.message,
      });
    }
  }

  return changes;
}
