import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-v4-options.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-v4-options', () => {
  it('rules', () => {
    tester.run('no-v4-options', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, {});` },
        { code: `const opts = { slaveOk: true };` }, // no mongodb import
      ],
      invalid: [
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { slaveOk: true });`,
          errors: [{ messageId: 'removed' }],
          output: `import { MongoClient } from 'mongodb'; new MongoClient(uri, {  });`,
        },
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { keepGoing: true, promiseLibrary: Promise });`,
          errors: [{ messageId: 'removed' }, { messageId: 'removed' }],
          output: `import { MongoClient } from 'mongodb'; new MongoClient(uri, {  promiseLibrary: Promise });`,
        },
      ],
    });
  });
});
