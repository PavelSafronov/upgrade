import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-pool-retry-label.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-pool-retry-label', () => {
  it('rules', () => {
    tester.run('no-pool-retry-label', rule, {
      valid: [
        { code: `error.hasErrorLabel('PoolRequestedRetry');` },
        { code: `const x = 'PoolRequstedFoo';` },
      ],
      invalid: [
        {
          code: `error.hasErrorLabel('PoolRequstedRetry');`,
          errors: [{ messageId: 'typo' }],
          output: `error.hasErrorLabel('PoolRequestedRetry');`,
        },
        {
          code: `error.hasErrorLabel("PoolRequstedRetry");`,
          errors: [{ messageId: 'typo' }],
          output: `error.hasErrorLabel("PoolRequestedRetry");`,
        },
      ],
    });
  });
});
