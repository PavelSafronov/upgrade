import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      streamTransform: "cursor.stream({ transform }) was removed in mongodb v7. Use cursor.stream().map(fn) instead.",
    },
    docs: {
      description: "Disallow cursor.stream({ transform: fn }) — removed in v7, use .stream().map(fn)",
      url: 'https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node: any) {
        if (node.callee?.type !== 'MemberExpression') return;
        if (node.callee.property?.name !== 'stream') return;
        if (node.arguments.length !== 1) return;
        const arg = node.arguments[0];
        if (arg.type !== 'ObjectExpression') return;
        const transformProp = arg.properties.find(
          (p: any) => p.type === 'Property' && !p.computed && p.key?.name === 'transform',
        );
        if (!transformProp) return;

        context.report({
          node,
          messageId: 'streamTransform',
          fix(fixer) {
            const sourceCode = context.getSourceCode();
            const fnText = sourceCode.getText(transformProp.value);
            const objectText = sourceCode.getText(node.callee.object);
            const remainingProps = arg.properties.filter((p: any) => p !== transformProp);

            if (remainingProps.length > 0) {
              const propsText = remainingProps.map((p: any) => sourceCode.getText(p)).join(', ');
              return fixer.replaceText(node, `${objectText}.stream({ ${propsText} }).map(${fnText})`);
            }
            return fixer.replaceText(node, `${objectText}.stream().map(${fnText})`);
          },
        });
      },
    };
  },
};

export default rule;
