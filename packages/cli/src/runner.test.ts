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
