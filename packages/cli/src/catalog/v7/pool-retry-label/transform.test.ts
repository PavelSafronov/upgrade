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
