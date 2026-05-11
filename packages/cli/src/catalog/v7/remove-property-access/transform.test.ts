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

describe('remove-property-access', () => {
  it('transforms fixture input to expected output', () => {
    const input = readFileSync(join(fixturesDir, 'input.ts'), 'utf8');
    const expected = readFileSync(join(fixturesDir, 'expected.ts'), 'utf8');
    expect(run(input)).toBe(expected);
  });

  it('leaves other member expressions unchanged', () => {
    const source = `const x = ReadPreference.PRIMARY;`;
    expect(run(source)).toBe(source);
  });
});
