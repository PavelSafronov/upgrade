import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      typo: "'PoolRequstedRetry' is a typo — the correct label is 'PoolRequestedRetry' (fixed in mongodb v7).",
    },
    docs: {
      description: "Fix typo 'PoolRequstedRetry' → 'PoolRequestedRetry' (v7)",
      url: 'https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/',
    },
    schema: [],
  },
  create(context) {
    return {
      Literal(node: any) {
        if (node.value !== 'PoolRequstedRetry') return;
        context.report({
          node,
          messageId: 'typo',
          fix(fixer) {
            const quote = (node.raw as string).startsWith("'") ? "'" : '"';
            return fixer.replaceText(node, `${quote}PoolRequestedRetry${quote}`);
          },
        });
      },
    };
  },
};

export default rule;
