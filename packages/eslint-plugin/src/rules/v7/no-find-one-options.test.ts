import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-find-one-options.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-find-one-options', () => {
  it('rules', () => {
    tester.run('no-find-one-options', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb'; collection.findOne({}, { projection: { _id: 0 } });` },
        { code: `const opts = { batchSize: 100 };` }, // no mongodb import
      ],
      invalid: [
        {
          code: `import { MongoClient } from 'mongodb'; collection.findOne({}, { batchSize: 10 });`,
          errors: [{ messageId: 'removed' }],
          output: `import { MongoClient } from 'mongodb'; collection.findOne({}, {  });`,
        },
        {
          code: `import { MongoClient } from 'mongodb'; collection.findOne({}, { limit: 1, noCursorTimeout: true });`,
          errors: [{ messageId: 'removed' }, { messageId: 'removed' }],
          output: `import { MongoClient } from 'mongodb'; collection.findOne({}, {  noCursorTimeout: true });`,
        },
      ],
    });
  });
});
