import type { Rule } from 'eslint';
import { isMongoDBSource } from '../../utils.js';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    messages: {
      removed:
        'cursor.count() was removed in mongodb v5. Use collection.countDocuments(query) for an exact count or collection.estimatedDocumentCount() for a fast approximation.',
    },
    docs: {
      description: 'Disallow cursor.count() removed in v5',
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
      CallExpression(node: any) {
        if (!hasMongoImport) return;
        const callee = node.callee;
        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier' || callee.property.name !== 'count') return;
        context.report({ node, messageId: 'removed' });
      },
    };
  },
};

export default rule;
