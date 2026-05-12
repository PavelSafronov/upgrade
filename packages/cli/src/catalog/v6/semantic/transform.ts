import type { API, FileInfo, Identifier } from 'jscodeshift';

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

export function transformAddUser(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'addUser' } },
    })
    .forEach(path => {
      addLeadingTodo(j, path,
        'db.addUser() has been removed in v6. Manage users via the MongoDB shell or a dedicated admin script.');
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

export function transformCollectionStats(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'stats' } },
    })
    .forEach(path => {
      addLeadingTodo(j, path,
        'collection.stats() has been removed in v6. Use db.command({ collStats: collectionName }) instead.');
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

export function transformFindOneAnd(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  const METHODS = new Set(['findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete']);

  root
    .find(j.CallExpression)
    .filter(path => {
      const callee = path.node.callee;
      return (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier' &&
        METHODS.has((callee.property as Identifier).name)
      );
    })
    .filter(path => {
      return !path.node.arguments.some(arg => {
        if (arg.type !== 'ObjectExpression') return false;
        return (arg as any).properties.some(
          (p: any) =>
            p.type === 'ObjectProperty' &&
            p.key.type === 'Identifier' &&
            p.key.name === 'includeResultMetadata',
        );
      });
    })
    .forEach(path => {
      const methodName = ((path.node.callee as any).property as Identifier).name;
      addLeadingTodo(j, path,
        `${methodName}() now returns the document directly (not wrapped in ModifyResult) unless you pass { includeResultMetadata: true }. Verify your code handles the new return type.`);
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

export function transformWithTransaction(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'withTransaction' } },
    })
    .filter(path => {
      const parent = path.parent?.node;
      return !j.ExpressionStatement.check(parent);
    })
    .forEach(path => {
      addLeadingTodo(j, path,
        'withTransaction() always returns void in v6. The return value of your callback is discarded.');
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

export default function transform(file: FileInfo, api: API): string | undefined {
  let source = file.source;
  for (const fn of [transformAddUser, transformCollectionStats, transformFindOneAnd, transformWithTransaction]) {
    const result = fn({ ...file, source }, api);
    if (result !== undefined) source = result;
  }
  return source !== file.source ? source : undefined;
}
