import type { API, FileInfo } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Only process files that actually import ObjectID from mongodb
  const hasObjectIdImport = root
    .find(j.ImportDeclaration, { source: { value: 'mongodb' } })
    .some(path =>
      path.node.specifiers?.some(s =>
        s.type === 'ImportSpecifier' && (s.imported as any).name === 'ObjectID'
      ) ?? false
    );

  const hasRequireDestructure = root.find(j.VariableDeclarator).some(path => {
    const init = path.node.init;
    if (!init || init.type !== 'CallExpression') return false;
    if ((init.callee as any).name !== 'require') return false;
    const arg = init.arguments[0];
    if (!arg || (arg as any).type !== 'StringLiteral' || (arg as any).value !== 'mongodb') return false;
    const id = path.node.id;
    if (id.type !== 'ObjectPattern') return false;
    return id.properties.some(p => p.type === 'ObjectProperty' && (p.key as any).name === 'ObjectID');
  });

  if (!hasObjectIdImport && !hasRequireDestructure) return undefined;

  let dirty = false;
  root.find(j.Identifier, { name: 'ObjectID' }).forEach(path => {
    path.node.name = 'ObjectId';
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
