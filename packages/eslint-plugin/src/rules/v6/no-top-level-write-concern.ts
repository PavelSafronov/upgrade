import type { Rule } from 'eslint';
import { isMongoDBSource } from '../../utils.js';

const TOP_LEVEL_OPTIONS = new Set(['j', 'w', 'wtimeout']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    messages: {
      removed:
        "'{{name}}' as a top-level MongoClient option was removed in mongodb v6. Move it inside a writeConcern object: { writeConcern: { {{name}}: ... } }. Note: wtimeout was renamed to wtimeoutMS.",
    },
    docs: {
      description: 'Disallow top-level write concern options (j, w, wtimeout) removed in v6',
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
        if (!name || !TOP_LEVEL_OPTIONS.has(name)) return;
        // Skip if already nested inside a writeConcern property
        const enclosingProp = node.parent?.parent;
        if (enclosingProp?.type === 'Property' && !enclosingProp.computed) {
          const enclosingKey = enclosingProp.key?.name ?? enclosingProp.key?.value;
          if (enclosingKey === 'writeConcern') return;
        }
        context.report({ node, messageId: 'removed', data: { name } });
      },
    };
  },
};

export default rule;
