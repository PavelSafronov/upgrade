import type { API, FileInfo, Identifier } from 'jscodeshift';

function addLeadingTodo(j: API['jscodeshift'], path: any, message: string): void {
  // Walk up to the containing statement so the comment appears before the whole line
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
  let dirty = false;

  // aws-explicit-credentials: URI containing MONGODB-AWS with user:pass@ credentials
  root.find(j.StringLiteral).filter(path => {
    const val = path.node.value;
    return val.includes('authMechanism=MONGODB-AWS') && /\/\/.+:.+@/.test(val);
  }).forEach(path => {
    addLeadingTodo(j, path,
      'MONGODB-AWS no longer accepts explicit credentials in the URI. Remove credentials and let @aws-sdk/credential-providers handle them.');
    dirty = true;
  });

  // mongodb-cr-auth
  root.find(j.StringLiteral, { value: 'MONGODB-CR' }).forEach(path => {
    addLeadingTodo(j, path,
      'MONGODB-CR auth mechanism has been removed. Switch to SCRAM-SHA-256 or another supported mechanism.');
    dirty = true;
  });

  // client-metadata-props
  const META_PROPS = new Set(['additionalDriverInfo', 'extendedMetadata']);
  root.find(j.MemberExpression).filter(path => {
    const prop = path.node.property;
    return prop.type === 'Identifier' && META_PROPS.has((prop as Identifier).name);
  }).forEach(path => {
    addLeadingTodo(j, path,
      `${(path.node.property as Identifier).name} is no longer part of the public API. Remove this access.`);
    dirty = true;
  });

  // cursor-implicit-batch-size: batchSize: 1000 in options object
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
