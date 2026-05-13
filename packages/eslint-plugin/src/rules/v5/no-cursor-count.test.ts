import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-cursor-count.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-cursor-count', () => {
  it('rules', () => {
    tester.run('no-cursor-count', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb'; cursor.countDocuments();` },
        { code: `cursor.count();` }, // no mongodb import
        { code: `import { MongoClient } from 'mongodb'; collection.estimatedDocumentCount();` },
      ],
      invalid: [
        {
          code: `import { MongoClient } from 'mongodb'; const n = await cursor.count();`,
          errors: [{ messageId: 'removed' }],
        },
        {
          code: `import { FindCursor } from 'mongodb'; const n = await cursor.count();`,
          errors: [{ messageId: 'removed' }],
        },
      ],
    });
  });
});
