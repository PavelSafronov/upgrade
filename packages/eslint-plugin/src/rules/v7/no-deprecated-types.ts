import type { Rule } from 'eslint';
import { isMongoDBSource, removeImportSpecifier } from '../../utils.js';

const REMOVED_TYPES = new Set([
  'CloseOptions', 'ResumeOptions', 'CancellationToken', 'Transaction',
  'ServerCapabilities', 'ClientMetadataOptions', 'FindOneOptions',
]);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      removed: "'{{name}}' was removed from mongodb in v7. Remove this import.",
    },
    docs: {
      description: 'Disallow importing removed v7 types (CloseOptions, CancellationToken, Transaction, etc.)',
      url: 'https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node: any) {
        if (!isMongoDBSource(node.source.value)) return;
        for (const spec of node.specifiers ?? []) {
          if (spec.type !== 'ImportSpecifier') continue;
          const name = spec.imported.name;
          if (!REMOVED_TYPES.has(name)) continue;
          context.report({
            node: spec,
            messageId: 'removed',
            data: { name },
            fix: (fixer) => removeImportSpecifier(fixer, spec, node, context.getSourceCode()),
          });
        }
      },
    };
  },
};

export default rule;
