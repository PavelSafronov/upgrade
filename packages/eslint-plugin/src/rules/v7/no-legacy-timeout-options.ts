import type { Rule } from 'eslint';
import { isMongoDBSource } from '../../utils.js';

const DEPRECATED_OPTIONS = new Set(['socketTimeoutMS', 'waitQueueTimeoutMS']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    messages: {
      deprecated:
        "'{{name}}' was deprecated in mongodb v6.11 in favour of the unified timeoutMS option (Client-Side Operations Timeout). Consider using timeoutMS on MongoClient instead.",
    },
    docs: {
      description: 'Disallow legacy timeout options deprecated in favour of timeoutMS (v6.11+)',
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
        if (!name || !DEPRECATED_OPTIONS.has(name)) return;
        context.report({ node, messageId: 'deprecated', data: { name } });
      },
    };
  },
};

export default rule;
