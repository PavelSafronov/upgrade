import type { Rule } from 'eslint';
import { isMongoDBSource, removeNode } from '../../utils.js';

// 'limit' excluded: too generic, causes false positives on bodyParser, pagination objects, etc.
const REMOVED_OPTIONS = new Set(['batchSize', 'noCursorTimeout']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      removed: "'{{name}}' was removed from FindOneOptions in mongodb v7. Remove this option.",
    },
    docs: {
      description: 'Disallow removed FindOneOptions properties (batchSize, noCursorTimeout) in v7',
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
      Property(node: any) {
        if (!hasMongoImport) return;
        const key = node.key;
        const name = node.computed ? null
                   : key.type === 'Identifier' ? key.name
                   : key.type === 'Literal' ? String(key.value)
                   : null;
        if (!name || !REMOVED_OPTIONS.has(name)) return;
        context.report({
          node,
          messageId: 'removed',
          data: { name },
          fix: (fixer) => removeNode(fixer, node, context.getSourceCode()),
        });
      },
    };
  },
};

export default rule;
