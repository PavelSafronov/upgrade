import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-stream-transform.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-stream-transform', () => {
  it('rules', () => {
    tester.run('no-stream-transform', rule, {
      valid: [
        { code: `cursor.stream();` },
        { code: `cursor.stream({ highWaterMark: 16 });` },
        { code: `cursor.stream().map(JSON.stringify);` },
      ],
      invalid: [
        {
          code: `const s = cursor.stream({ transform: JSON.stringify });`,
          errors: [{ messageId: 'streamTransform' }],
          output: `const s = cursor.stream().map(JSON.stringify);`,
        },
        {
          code: `const s = cursor.stream({ transform: fn, highWaterMark: 16 });`,
          errors: [{ messageId: 'streamTransform' }],
          output: `const s = cursor.stream({ highWaterMark: 16 }).map(fn);`,
        },
      ],
    });
  });
});
