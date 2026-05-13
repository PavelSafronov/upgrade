import type { API, FileInfo, ObjectProperty, Identifier, StringLiteral } from 'jscodeshift';

const DEPRECATED_TIMEOUT_OPTIONS = new Set(['socketTimeoutMS', 'waitQueueTimeoutMS']);

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

function propName(prop: any): string | null {
  const key = (prop as ObjectProperty).key;
  return key.type === 'Identifier' ? (key as Identifier).name
       : key.type === 'StringLiteral' ? (key as StringLiteral).value
       : null;
}

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);

  if (root.find(j.ImportDeclaration, { source: { value: 'mongodb' } }).length === 0) return undefined;

  let dirty = false;

  root.find(j.ObjectExpression).forEach(path => {
    const matchedNames = path.node.properties
      .filter(p => p.type === 'ObjectProperty')
      .map(p => propName(p))
      .filter((n): n is string => n !== null && DEPRECATED_TIMEOUT_OPTIONS.has(n));

    if (matchedNames.length === 0) return;

    addLeadingTodo(j, path,
      `${matchedNames.join(', ')} deprecated in v6.11 in favour of the unified timeoutMS option (Client-Side Operations Timeout). Consider replacing per-operation timeouts with timeoutMS on MongoClient.`);
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
