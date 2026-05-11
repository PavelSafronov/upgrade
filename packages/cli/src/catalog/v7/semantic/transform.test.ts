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

describe('semantic flags', () => {
  it('flags MONGODB-CR auth', () => {
    const source = `const c = new MongoClient(uri, { authMechanism: 'MONGODB-CR' });`;
    const result = run(source);
    expect(result).toContain('TODO(mongodb-upgrade)');
    expect(result).toContain('MONGODB-CR');
  });

  it('flags additionalDriverInfo access', () => {
    const source = `console.log(client.options.additionalDriverInfo);`;
    const result = run(source);
    expect(result).toContain('TODO(mongodb-upgrade)');
  });

  it('flags batchSize: 1000', () => {
    const source = `collection.find({}, { batchSize: 1000 });`;
    const result = run(source);
    expect(result).toContain('TODO(mongodb-upgrade)');
  });

  it('leaves batchSize: 500 unchanged', () => {
    const source = `collection.find({}, { batchSize: 500 });`;
    expect(run(source)).toBe(source);
  });

  it('flags AWS URI with embedded credentials', () => {
    const source = `new MongoClient('mongodb://AKID:SECRET@host/?authMechanism=MONGODB-AWS');`;
    const result = run(source);
    expect(result).toContain('TODO(mongodb-upgrade)');
  });
});
