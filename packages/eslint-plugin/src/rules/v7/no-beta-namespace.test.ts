import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-beta-namespace.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-beta-namespace', () => {
  it('rules', () => {
    tester.run('no-beta-namespace', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb';` },
        { code: `import { MongoClient } from 'mongodb-beta';` },
      ],
      invalid: [
        {
          code: `import { MongoClient } from 'mongodb/beta';`,
          errors: [{ messageId: 'removed' }],
          output: `import { MongoClient } from 'mongodb';`,
        },
      ],
    });
  });
});
