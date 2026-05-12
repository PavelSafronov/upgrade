import { createRequire } from 'node:module';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-objectid.js';

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-objectid', () => {
  it('rules', () => {
    tester.run('no-objectid', rule, {
      valid: [
        { code: `import { ObjectId } from 'mongodb';` },
        { code: `import { ObjectID } from 'other-pkg';` },
        { code: `const x = ObjectID;` }, // not from mongodb
      ],
      invalid: [
        {
          code: `import { ObjectID } from 'mongodb'; const id = new ObjectID();`,
          errors: [{ messageId: 'rename' }, { messageId: 'rename' }],
          output: `import { ObjectId } from 'mongodb'; const id = new ObjectId();`,
        },
        {
          code: `import { ObjectID as OID } from 'mongodb';`,
          errors: [{ messageId: 'rename' }],
          output: `import { ObjectId as OID } from 'mongodb';`,
        },
      ],
    });
  });
});
