import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-deprecated-gridfs-options.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-deprecated-gridfs-options', () => {
  it('rules', () => {
    tester.run('no-deprecated-gridfs-options', rule, {
      valid: [
        { code: `import { GridFSBucket } from 'mongodb'; bucket.openUploadStream('f.txt', {});` },
        { code: `const opts = { contentType: 'text/plain' };` }, // no mongodb import
      ],
      invalid: [
        {
          code: `import { GridFSBucket } from 'mongodb'; bucket.openUploadStream('f.txt', { contentType: 'text/plain' });`,
          errors: [{ messageId: 'removed' }],
          output: `import { GridFSBucket } from 'mongodb'; bucket.openUploadStream('f.txt', {  });`,
        },
        {
          code: `import { GridFSBucket } from 'mongodb'; bucket.openUploadStream('f.txt', { contentType: 'text/plain', aliases: ['doc'] });`,
          errors: [{ messageId: 'removed' }, { messageId: 'removed' }],
          output: `import { GridFSBucket } from 'mongodb'; bucket.openUploadStream('f.txt', {  aliases: ['doc'] });`,
        },
      ],
    });
  });
});
