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

describe('remove-client-options', () => {
  it('transforms fixture input to expected output', () => {
    const input = readFileSync(join(fixturesDir, 'input.ts'), 'utf8');
    const expected = readFileSync(join(fixturesDir, 'expected.ts'), 'utf8');
    expect(run(input)).toBe(expected);
  });

  it('leaves unrelated object properties unchanged', () => {
    const source = `const opts = { maxPoolSize: 10, connectTimeoutMS: 5000 };`;
    expect(run(source)).toBe(source);
  });

  it('removes retryWrites from command options in a mongodb file', () => {
    const source = `import { MongoClient } from 'mongodb';\ndb.command({}, { retryWrites: false, comment: 'x' });`;
    const result = run(source);
    expect(result).not.toContain('retryWrites');
    expect(result).toContain('comment');
  });

  it('leaves retryWrites untouched in files with no mongodb import', () => {
    const source = `db.command({}, { retryWrites: false, comment: 'x' });`;
    expect(run(source)).toBe(source);
  });
});
