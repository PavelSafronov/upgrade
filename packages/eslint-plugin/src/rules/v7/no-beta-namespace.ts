import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      removed: "The 'mongodb/beta' export was removed in mongodb v7. Import from 'mongodb' instead.",
    },
    docs: {
      description: "Disallow importing from 'mongodb/beta' (removed in v7)",
      url: 'https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node: any) {
        if (node.source.value !== 'mongodb/beta') return;
        context.report({
          node: node.source,
          messageId: 'removed',
          fix: (fixer) => fixer.replaceText(node.source, "'mongodb'"),
        });
      },
    };
  },
};

export default rule;
