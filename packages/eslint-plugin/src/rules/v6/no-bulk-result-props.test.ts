import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-bulk-result-props.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-bulk-result-props', () => {
  it('rules', () => {
    tester.run('no-bulk-result-props', rule, {
      valid: [
        { code: `import { MongoClient } from 'mongodb'; result.insertedCount;` },
        { code: `result.nInserted;` }, // no mongodb import
      ],
      invalid: [
        {
          code: `import { MongoClient } from 'mongodb'; console.log(result.nInserted);`,
          errors: [{ messageId: 'renamed' }],
          output: `import { MongoClient } from 'mongodb'; console.log(result.insertedCount);`,
        },
        {
          code: `import { MongoClient } from 'mongodb'; const x = r.nRemoved + r.nModified;`,
          errors: [{ messageId: 'renamed' }, { messageId: 'renamed' }],
          output: `import { MongoClient } from 'mongodb'; const x = r.deletedCount + r.modifiedCount;`,
        },
      ],
    });
  });
});
