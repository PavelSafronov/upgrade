import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-numeric-bool-options.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-numeric-bool-options', () => {
  it('rules', () => {
    tester.run('no-numeric-bool-options', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { tls: true });` },
        { code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { tls: false });` },
        { code: `const opts = { tls: 1 };` }, // no mongodb import
        { code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { directConnection: true });` },
      ],
      invalid: [
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { tls: 1 });`,
          errors: [{ messageId: 'numericBool' }],
          output: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { tls: true });`,
        },
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { ssl: 0 });`,
          errors: [{ messageId: 'numericBool' }],
          output: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { ssl: false });`,
        },
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { tls: 1, directConnection: 0 });`,
          errors: [{ messageId: 'numericBool' }, { messageId: 'numericBool' }],
          output: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { tls: true, directConnection: false });`,
        },
      ],
    });
  });
});
