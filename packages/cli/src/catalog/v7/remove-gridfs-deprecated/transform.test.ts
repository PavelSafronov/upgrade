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

describe('remove-gridfs-deprecated', () => {
  it('transforms fixture input to expected output', () => {
    const input = readFileSync(join(fixturesDir, 'input.ts'), 'utf8');
    const expected = readFileSync(join(fixturesDir, 'expected.ts'), 'utf8');
    expect(run(input)).toBe(expected);
  });

  it('leaves unrelated object properties unchanged', () => {
    const source = `const opts = { chunkSizeBytes: 1024, metadata: {} };`;
    expect(run(source)).toBe(source);
  });

  it('does not remove contentType from non-GridFS mongodb imports', () => {
    // reproduces overleaf-pro false positive: file imports Binary/ObjectId from
    // mongodb but passes contentType to an object-persistor (S3-style) API
    const source = `
import { Binary, ObjectId } from 'mongodb';
await persistor.sendStream(bucket, key, stream, {
  contentType: 'application/octet-stream',
  contentLength: size,
});`;
    expect(run(source)).toBe(source);
  });

  it('still removes contentType when GridFSBucket is imported', () => {
    const source = `
import { GridFSBucket } from 'mongodb';
const opts = { contentType: 'text/plain', chunkSizeBytes: 1024 };`;
    const result = run(source);
    expect(result).not.toContain('contentType');
    expect(result).toContain('chunkSizeBytes');
  });
});
