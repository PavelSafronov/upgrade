import type { Rule } from 'eslint';
import { isMongoDBSource, removeNode } from '../../utils.js';

const REMOVED_OPTIONS = new Set([
  'sslCA', 'sslCRL', 'sslCert', 'sslKey', 'sslPass', 'sslValidate', 'tlsCertificateFile',
  'keepAlive', 'keepAliveInitialDelay',
]);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      removed: "'{{name}}' was removed in mongodb v6. Remove this option (see migration docs for tls* equivalents).",
    },
    docs: {
      description: 'Disallow removed v6 connection options (ssl*, keepAlive*)',
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
