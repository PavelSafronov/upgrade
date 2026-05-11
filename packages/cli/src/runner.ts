import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import jscodeshift, { type API } from 'jscodeshift';
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
    if (codemod.kind === 'env') continue;

    for (const relPath of files) {
      const absPath = join(cwd, relPath);
      const source = readFileSync(absPath, 'utf8');

      const fakeApi = { jscodeshift: j, j, stats: () => {}, report: () => {} } as unknown as API;
      const result = codemod.transform!(
        { source, path: relPath },
        fakeApi,
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
