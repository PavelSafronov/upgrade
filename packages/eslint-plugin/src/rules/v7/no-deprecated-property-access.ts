import type { Rule } from 'eslint';
import { isMongoDBSource } from '../../utils.js';

const REMOVED: Array<{ object: string; property: string; messageId: string }> = [
  { object: 'ReadPreference', property: 'minWireVersion', messageId: 'minWireVersion' },
  { object: 'session', property: 'transaction', messageId: 'sessionTransaction' },
];

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    messages: {
      minWireVersion: "'ReadPreference.minWireVersion' was removed in mongodb v7. Remove this access.",
      sessionTransaction: "'session.transaction' was removed in mongodb v7. Remove this access.",
    },
    docs: {
      description: 'Disallow access to removed properties (ReadPreference.minWireVersion, session.transaction) in v7',
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
      MemberExpression(node: any) {
        if (!hasMongoImport || node.computed) return;
        if (node.object.type !== 'Identifier' || node.property.type !== 'Identifier') return;
        const obj = node.object.name;
        const prop = node.property.name;
        const match = REMOVED.find(r => r.object === obj && r.property === prop);
        if (!match) return;
        context.report({ node, messageId: match.messageId });
      },
    };
  },
};

export default rule;
