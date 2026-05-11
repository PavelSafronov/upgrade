import type { API, FileInfo } from 'jscodeshift';

const REMOVED_PROPERTY_ACCESS: Array<{ object: string; property: string; note: string }> = [
  { object: 'ReadPreference', property: 'minWireVersion', note: 'ReadPreference.minWireVersion removed in v7' },
  { object: 'session', property: 'transaction', note: 'session.transaction removed in v7' },
];

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  for (const { object, property, note } of REMOVED_PROPERTY_ACCESS) {
    root
      .find(j.MemberExpression, {
        object: { type: 'Identifier', name: object },
        property: { type: 'Identifier', name: property },
      })
      .forEach(path => {
        // Walk up to the containing statement to attach the comment there
        let stmtPath: any = path;
        while (stmtPath.parent && !j.Statement.check(stmtPath.parent.node)) {
          stmtPath = stmtPath.parent;
        }
        const stmtNode = stmtPath.parent ? stmtPath.parent.node : stmtPath.node;
        const comment: any = {
          type: 'CommentLine',
          value: ` TODO(mongodb-upgrade): ${note}`,
          leading: true,
          trailing: false,
        };
        stmtNode.comments = [...(stmtNode.comments ?? []), comment];

        j(path).replaceWith(j.identifier('undefined'));
        dirty = true;
      });
  }

  return dirty ? root.toSource() : undefined;
}
