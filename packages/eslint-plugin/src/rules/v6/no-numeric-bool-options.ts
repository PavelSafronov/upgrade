import type { Rule } from 'eslint';
import { isMongoDBSource } from '../../utils.js';

const BOOLEAN_OPTIONS = new Set([
  'tls', 'ssl', 'tlsInsecure', 'tlsAllowInvalidCertificates', 'tlsAllowInvalidHostnames',
  'directConnection', 'loadBalanced', 'noDelay', 'rejectUnauthorized',
]);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      numericBool:
        "'{{name}}' expects a boolean but received a number. Boolean coercion was removed in mongodb v6. Use {{fix}} instead.",
    },
    docs: {
      description: 'Disallow numeric values for boolean MongoClient options (coercion removed in v6)',
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
        if (!name || !BOOLEAN_OPTIONS.has(name)) return;

        const value = node.value;
        if (value.type !== 'Literal' || typeof value.value !== 'number') return;

        const fix = value.value !== 0 ? 'true' : 'false';
        context.report({
          node: value,
          messageId: 'numericBool',
          data: { name, fix },
          fix: (fixer) => fixer.replaceText(value, fix),
        });
      },
    };
  },
};

export default rule;
