import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-deprecated-client-options.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-deprecated-client-options', () => {
  it('rules', () => {
    tester.run('no-deprecated-client-options', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb'; new MongoClient(uri);` },
        { code: `const opts = { useNewUrlParser: true };` }, // no mongodb import
      ],
      invalid: [
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });`,
          errors: [{ messageId: 'removed' }, { messageId: 'removed' }],
          output: `import { MongoClient } from 'mongodb'; new MongoClient(uri, {  useUnifiedTopology: true });`,
        },
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { retryWrites: false });`,
          errors: [{ messageId: 'removed' }],
          output: `import { MongoClient } from 'mongodb'; new MongoClient(uri, {  });`,
        },
      ],
    });
  });
});
