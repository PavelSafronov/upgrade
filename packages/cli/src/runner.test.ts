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

  it('transforms a Flow-annotated file using the flow parser', async () => {
    // ?string is Flow nullable syntax — the tsx parser rejects it.
    // If the file were processed with tsx, the parse error would skip it and
    // produce no changes. Success here proves the flow parser path is taken.
    writeFileSync(join(tmp, 'adapter.js'), [
      '// @flow',
      'type Opts = ?string;',
      'var oldName = 1;',
    ].join('\n'));

    const codemod: Codemod = {
      id: 'flow-rename-test',
      description: 'rename oldName → newName via jscodeshift (requires flow parser)',
      kind: 'mechanical',
      hop: { from: '6.x', to: '7.x' },
      packages: ['mongodb'],
      transform: (file, api) => {
        const j = api.jscodeshift;
        const root = j(file.source);
        let dirty = false;
        root.find(j.Identifier, { name: 'oldName' }).forEach((path: any) => {
          path.node.name = 'newName';
          dirty = true;
        });
        return dirty ? root.toSource() : undefined;
      },
    };

    const changes = await runCodemods([codemod], tmp, { dryRun: false });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ codemod: 'flow-rename-test', status: 'applied' });
    expect(readFileSync(join(tmp, 'adapter.js'), 'utf8')).toContain('newName');
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
