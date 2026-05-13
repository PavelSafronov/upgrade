import type { API, FileInfo } from 'jscodeshift';

function addLeadingTodo(j: API['jscodeshift'], path: any, message: string): void {
  let stmtPath: any = path;
  while (stmtPath.parent && !j.Statement.check(stmtPath.parent.node)) {
    stmtPath = stmtPath.parent;
  }
  const stmtNode = stmtPath.parent ? stmtPath.parent.node : stmtPath.node;
  const comment: any = {
    type: 'CommentLine',
    value: ` TODO(mongodb-upgrade): ${message}`,
    leading: true,
    trailing: false,
  };
  stmtNode.comments = [...(stmtNode.comments ?? []), comment];
}

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);

  if (root.find(j.ImportDeclaration, { source: { value: 'mongodb' } }).length === 0) return undefined;

  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'count' } },
    })
    .forEach(path => {
      addLeadingTodo(j, path,
        'cursor.count() was removed in v5. Use collection.countDocuments(query) for an exact count or collection.estimatedDocumentCount() for a fast approximation.');
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}
