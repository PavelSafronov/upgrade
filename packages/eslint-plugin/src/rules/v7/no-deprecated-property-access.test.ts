import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-deprecated-property-access.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-deprecated-property-access', () => {
  it('rules', () => {
    tester.run('no-deprecated-property-access', rule, {
      valid: [
        { code: `import { ReadPreference } from 'mongodb'; ReadPreference.PRIMARY;` },
        { code: `ReadPreference.minWireVersion;` }, // no mongodb import
      ],
      invalid: [
        {
          code: `import { ReadPreference } from 'mongodb'; const v = ReadPreference.minWireVersion;`,
          errors: [{ messageId: 'minWireVersion' }],
        },
        {
          code: `import { ClientSession } from 'mongodb'; const t = session.transaction;`,
          errors: [{ messageId: 'sessionTransaction' }],
        },
      ],
    });
  });
});
