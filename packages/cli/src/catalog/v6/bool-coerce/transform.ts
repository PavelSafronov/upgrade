import type { API, FileInfo, ObjectProperty, Identifier, StringLiteral } from 'jscodeshift';

const BOOLEAN_OPTIONS = new Set([
  'tls', 'ssl', 'tlsInsecure', 'tlsAllowInvalidCertificates', 'tlsAllowInvalidHostnames',
  'directConnection', 'loadBalanced', 'noDelay', 'rejectUnauthorized',
]);

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);

  if (root.find(j.ImportDeclaration, { source: { value: 'mongodb' } }).length === 0) return undefined;

  let dirty = false;

  root.find(j.ObjectExpression).forEach(path => {
    for (const prop of path.node.properties) {
      if (prop.type !== 'ObjectProperty') continue;
      const objProp = prop as ObjectProperty;
      const key = objProp.key;
      const name = key.type === 'Identifier' ? (key as Identifier).name
                 : key.type === 'StringLiteral' ? (key as StringLiteral).value
                 : null;
      if (!name || !BOOLEAN_OPTIONS.has(name)) continue;

      const value = objProp.value;
      if (value.type !== 'NumericLiteral') continue;
      const numVal = (value as any).value;
      if (typeof numVal !== 'number') continue;

      objProp.value = j.booleanLiteral(numVal !== 0);
      dirty = true;
    }
  });

  return dirty ? root.toSource() : undefined;
}
