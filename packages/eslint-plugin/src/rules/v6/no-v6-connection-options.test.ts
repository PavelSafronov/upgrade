import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-v6-connection-options.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-v6-connection-options', () => {
  it('rules', () => {
    tester.run('no-v6-connection-options', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { tls: true });` },
        { code: `const opts = { sslCA: 'path' };` }, // no mongodb import
      ],
      invalid: [
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { sslValidate: false });`,
          errors: [{ messageId: 'removed' }],
          output: `import { MongoClient } from 'mongodb'; new MongoClient(uri, {  });`,
        },
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { keepAlive: true, tls: true });`,
          errors: [{ messageId: 'removed' }],
          output: `import { MongoClient } from 'mongodb'; new MongoClient(uri, {  tls: true });`,
        },
      ],
    });
  });
});
