import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-find-options-generic.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-find-options-generic', () => {
  it('rules', () => {
    tester.run('no-find-options-generic', rule, {
      valid: [
        { code: `import { FindOptions } from 'mongodb'; const opts: FindOptions = {};` },
        { code: `const opts: FindOptions<Doc> = {};` }, // no mongodb import
      ],
      invalid: [
        {
          code: `import { FindOptions } from 'mongodb'; const opts: FindOptions<{ name: string }> = {};`,
          errors: [{ messageId: 'noTypeParam' }],
          output: `import { FindOptions } from 'mongodb'; const opts: FindOptions = {};`,
        },
      ],
    });
  });
});
