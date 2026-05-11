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

export function transformAwsCredentials(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.StringLiteral).filter(path => {
    const val = path.node.value;
    return val.includes('authMechanism=MONGODB-AWS') && /\/\/.+:.+@/.test(val);
  }).forEach(path => {
    addLeadingTodo(j, path,
      'MONGODB-AWS no longer accepts explicit credentials in the URI. Remove credentials and let @aws-sdk/credential-providers handle them.');
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}

export function transformMongoCR(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.StringLiteral, { value: 'MONGODB-CR' }).forEach(path => {
    addLeadingTodo(j, path,
      'MONGODB-CR auth mechanism has been removed. Switch to SCRAM-SHA-256 or another supported mechanism.');
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}

export function transformClientMetadata(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  const META_PROPS = new Set(['additionalDriverInfo', 'extendedMetadata']);
  root.find(j.MemberExpression).filter(path => {
    const prop = path.node.property;
    return prop.type === 'Identifier' && META_PROPS.has((prop as Identifier).name);
  }).forEach(path => {
    addLeadingTodo(j, path,
      `${(path.node.property as Identifier).name} is no longer part of the public API. Remove this access.`);
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}

export function transformBatchSize(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.ObjectProperty).filter(path => {
    const key = path.node.key;
    const val = path.node.value;
    return key.type === 'Identifier' && (key as Identifier).name === 'batchSize' &&
           val.type === 'NumericLiteral' && (val as any).value === 1000;
  }).forEach(path => {
    addLeadingTodo(j, path,
      'batchSize: 1000 may have been compensating for the now-removed default of 1000. Verify this is intentional.');
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}

// Combined transform used in tests (exercises all patterns at once)
export default function transform(file: FileInfo, api: API): string | undefined {
  let source = file.source;
  for (const fn of [transformAwsCredentials, transformMongoCR, transformClientMetadata, transformBatchSize]) {
    const result = fn({ ...file, source }, api);
    if (result !== undefined) source = result;
  }
  return source !== file.source ? source : undefined;
}
