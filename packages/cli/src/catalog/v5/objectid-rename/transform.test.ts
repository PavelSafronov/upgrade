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

describe('objectid-rename', () => {
  it('renames ObjectID to ObjectId when imported from mongodb', () => {
    const source = `import { ObjectID } from 'mongodb';\nconst id = new ObjectID();`;
    const result = run(source);
    expect(result).toContain("import { ObjectId } from 'mongodb'");
    expect(result).toContain('new ObjectId()');
    expect(result).not.toContain('ObjectID');
  });

  it('leaves ObjectID untouched in files with no mongodb import', () => {
    const source = `class ObjectID {}\nconst id = new ObjectID();`;
    expect(run(source)).toBe(source);
  });

  it('renames ObjectID when destructured from require', () => {
    const source = `const { ObjectID } = require('mongodb');\nconst id = new ObjectID('abc');`;
    const result = run(source);
    expect(result).toContain('ObjectId');
    expect(result).not.toContain('ObjectID');
  });
});
