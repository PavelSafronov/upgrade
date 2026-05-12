import type { Rule } from 'eslint';
import { isMongoDBSource } from '../../utils.js';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      noTypeParam: "'FindOptions' no longer accepts a type parameter in mongodb v7. Use 'FindOptions' without the generic.",
    },
    docs: {
      description: "Disallow type parameters on 'FindOptions' (removed in v7)",
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
      // TSTypeReference fires when @typescript-eslint/parser is in use
      TSTypeReference(node: any) {
        if (!hasMongoImport) return;
        if (node.typeName?.type !== 'Identifier') return;
        if (node.typeName.name !== 'FindOptions') return;
        // @typescript-eslint/parser v7+ uses typeArguments; v6 used typeParameters
        const typeArgs = node.typeArguments ?? node.typeParameters;
        if (!typeArgs) return;
        context.report({
          node: typeArgs,
          messageId: 'noTypeParam',
          fix: (fixer) => fixer.remove(typeArgs),
        });
      },
    };
  },
};

export default rule;
