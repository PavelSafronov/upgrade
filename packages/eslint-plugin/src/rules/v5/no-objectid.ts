import type { Rule } from 'eslint';
import { isMongoDBSource } from '../../utils.js';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      rename: "'ObjectID' was removed in mongodb v5. Use 'ObjectId' instead.",
    },
    docs: {
      description: "Require 'ObjectId' instead of deprecated 'ObjectID' alias (v5)",
      url: 'https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/',
    },
    schema: [],
  },
  create(context) {
    let objectIDImported = false;

    return {
      ImportDeclaration(node: any) {
        if (!isMongoDBSource(node.source.value)) return;
        for (const spec of node.specifiers ?? []) {
          if (spec.type === 'ImportSpecifier' && spec.imported.name === 'ObjectID') {
            objectIDImported = true;
            context.report({
              node: spec.imported,
              messageId: 'rename',
              fix: (fixer) => fixer.replaceText(spec.imported, 'ObjectId'),
            });
          }
        }
      },
      Identifier(node: any) {
        if (!objectIDImported || node.name !== 'ObjectID') return;
        if (node.parent?.type === 'ImportSpecifier') return; // handled in ImportDeclaration
        context.report({
          node,
          messageId: 'rename',
          fix: (fixer) => fixer.replaceText(node, 'ObjectId'),
        });
      },
    };
  },
};

export default rule;
