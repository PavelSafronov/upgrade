import type { Rule } from 'eslint';
import { isMongoDBSource } from '../../utils.js';

const RENAMED_PROPS: Record<string, string> = {
  nInserted: 'insertedCount',
  nUpserted: 'upsertedCount',
  nMatched: 'matchedCount',
  nModified: 'modifiedCount',
  nRemoved: 'deletedCount',
};

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      renamed: "'{{old}}' was removed from BulkWriteResult in mongodb v6. Use '{{replacement}}' instead.",
    },
    docs: {
      description: 'Disallow removed BulkWriteResult properties (nInserted, nUpserted, nMatched, nModified, nRemoved)',
      url: 'https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/',
    },
    schema: [],
  },
  create(context) {
    let hasMongoImport = false;

    return {
      ImportDeclaration(node: any) {
        if (isMongoDBSource(node.source.value)) hasMongoImport = true;
      },
      MemberExpression(node: any) {
        if (!hasMongoImport || node.computed) return;
        const prop = node.property;
        if (prop.type !== 'Identifier') return;
        const replacement = RENAMED_PROPS[prop.name];
        if (!replacement) return;
        context.report({
          node: prop,
          messageId: 'renamed',
          data: { old: prop.name, replacement },
          fix: (fixer) => fixer.replaceText(prop, replacement),
        });
      },
    };
  },
};

export default rule;
