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

const LEGACY_METHODS = new Map([
  ['insert', 'insertOne() / insertMany()'],
  ['update', 'updateOne() / updateMany()'],
  ['remove', 'deleteOne() / deleteMany()'],
]);

export function transformLegacyMethods(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  for (const [method, replacement] of LEGACY_METHODS) {
    root
      .find(j.CallExpression, {
        callee: { type: 'MemberExpression', property: { type: 'Identifier', name: method } },
      })
      .forEach(path => {
        addLeadingTodo(j, path,
          `collection.${method}() has been removed in v5. Use ${replacement} instead.`);
        dirty = true;
      });
  }

  return dirty ? root.toSource() : undefined;
}

export function transformMapReduce(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'mapReduce' } },
    })
    .forEach(path => {
      addLeadingTodo(j, path,
        'collection.mapReduce() has been removed in v5. Rewrite using the aggregation pipeline ($group, $project, etc.) instead.');
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

const MONGO_CALLBACK_METHODS = new Set([
  'find', 'findOne', 'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete',
  'insertOne', 'insertMany', 'insert',
  'updateOne', 'updateMany', 'update',
  'deleteOne', 'deleteMany', 'remove',
  'replaceOne', 'aggregate', 'countDocuments', 'count', 'distinct',
  'bulkWrite', 'createIndex', 'dropCollection',
]);

export function transformCallbackApi(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression)
    .filter(path => {
      const callee = path.node.callee;
      if (callee.type !== 'MemberExpression') return false;
      const prop = callee.property;
      if (prop.type !== 'Identifier') return false;
      if (!MONGO_CALLBACK_METHODS.has((prop as Identifier).name)) return false;
      const args = path.node.arguments;
      if (args.length === 0) return false;
      const lastArg = args[args.length - 1];
      return lastArg.type === 'ArrowFunctionExpression' || lastArg.type === 'FunctionExpression';
    })
    .forEach(path => {
      const methodName = ((path.node.callee as any).property as Identifier).name;
      addLeadingTodo(j, path,
        `Callback-based .${methodName}() has been removed in v5. Convert to async/await: const result = await collection.${methodName}(...args).`);
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

export default function transform(file: FileInfo, api: API): string | undefined {
  let source = file.source;
  for (const fn of [transformLegacyMethods, transformMapReduce, transformCallbackApi]) {
    const result = fn({ ...file, source }, api);
    if (result !== undefined) source = result;
  }
  return source !== file.source ? source : undefined;
}
