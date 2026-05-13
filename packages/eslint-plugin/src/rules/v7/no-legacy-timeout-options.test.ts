import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-legacy-timeout-options.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-legacy-timeout-options', () => {
  it('rules', () => {
    tester.run('no-legacy-timeout-options', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { timeoutMS: 5000 });` },
        { code: `const opts = { socketTimeoutMS: 5000 };` }, // no mongodb import
        { code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { connectTimeoutMS: 10000 });` },
      ],
      invalid: [
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { socketTimeoutMS: 5000 });`,
          errors: [{ messageId: 'deprecated' }],
        },
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { waitQueueTimeoutMS: 2000 });`,
          errors: [{ messageId: 'deprecated' }],
        },
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { socketTimeoutMS: 5000, waitQueueTimeoutMS: 2000 });`,
          errors: [{ messageId: 'deprecated' }, { messageId: 'deprecated' }],
        },
      ],
    });
  });
});
