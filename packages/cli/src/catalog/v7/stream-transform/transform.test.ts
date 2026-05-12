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

  it('preserves sibling options when transform is not the only key', () => {
    const source = `const s = cursor.stream({ transform: JSON.stringify, highWaterMark: 16 });`;
    const result = run(source);
    expect(result).toContain('highWaterMark: 16');
    expect(result).toContain('.map(JSON.stringify)');
    expect(result).not.toContain('transform:');
  });
});
