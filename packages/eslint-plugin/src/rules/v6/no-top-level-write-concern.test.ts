import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-top-level-write-concern.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-top-level-write-concern', () => {
  it('rules', () => {
    tester.run('no-top-level-write-concern', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { writeConcern: { j: true, w: 'majority' } });` },
        { code: `const opts = { j: true, wtimeout: 5000 };` }, // no mongodb import
        { code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { tls: true });` },
      ],
      invalid: [
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { j: true });`,
          errors: [{ messageId: 'removed' }],
        },
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { w: 'majority', wtimeout: 5000 });`,
          errors: [{ messageId: 'removed' }, { messageId: 'removed' }],
        },
        {
          code: `import { MongoClient } from 'mongodb'; new MongoClient(uri, { j: false, w: 1, wtimeout: 1000 });`,
          errors: [{ messageId: 'removed' }, { messageId: 'removed' }, { messageId: 'removed' }],
        },
      ],
    });
  });
});
