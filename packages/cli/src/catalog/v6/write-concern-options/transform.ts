import type { API, FileInfo, ObjectProperty, Identifier, StringLiteral } from 'jscodeshift';

const TOP_LEVEL_WRITE_CONCERN = new Set(['j', 'w', 'wtimeout']);

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
      .filter((n): n is string => n !== null && TOP_LEVEL_WRITE_CONCERN.has(n));

    if (matchedNames.length === 0) return;

    addLeadingTodo(j, path,
      `Top-level write concern options (${matchedNames.join(', ')}) were removed in v6. Move them inside a writeConcern object: { writeConcern: { j, w, wtimeoutMS } }. Note: wtimeout was renamed to wtimeoutMS.`);
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
