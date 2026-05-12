import { describe, it, expect } from 'vitest';
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

describe('bulk-result-props', () => {
  it('replaces nInserted with undefined and adds TODO when mongodb is imported', () => {
    const source = `import { MongoClient } from 'mongodb';\nconst n = result.nInserted;`;
    const result = run(source);
    expect(result).toContain('undefined');
    expect(result).toContain('TODO(mongodb-upgrade)');
    expect(result).not.toContain('result.nInserted');
  });

  it('leaves nInserted untouched in files with no mongodb import', () => {
    const source = `const n = result.nInserted;`;
    expect(run(source)).toBe(source);
  });

  it('replaces all five removed props', () => {
    const source = [
      "import { MongoClient } from 'mongodb';",
      'const r = res.nInserted + res.nUpserted + res.nMatched + res.nModified + res.nRemoved;',
    ].join('\n');
    const result = run(source);
    for (const prop of ['nInserted', 'nUpserted', 'nMatched', 'nModified', 'nRemoved']) {
      expect(result).not.toContain(`res.${prop}`);
    }
  });
});
