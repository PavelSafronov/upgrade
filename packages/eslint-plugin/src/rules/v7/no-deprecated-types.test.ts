import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-deprecated-types.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-deprecated-types', () => {
  it('rules', () => {
    tester.run('no-deprecated-types', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb';` },
        { code: `import { CloseOptions } from 'other-pkg';` },
      ],
      invalid: [
        {
          code: `import { CloseOptions } from 'mongodb';`,
          errors: [{ messageId: 'removed' }],
          output: ``,
        },
        {
          code: `import { MongoClient, CancellationToken } from 'mongodb';`,
          errors: [{ messageId: 'removed' }],
          output: `import { MongoClient } from 'mongodb';`,
        },
        {
          code: `import { CloseOptions, CancellationToken } from 'mongodb';`,
          errors: [{ messageId: 'removed' }, { messageId: 'removed' }],
          output: `import {  CancellationToken } from 'mongodb';`,
        },
      ],
    });
  });
});
