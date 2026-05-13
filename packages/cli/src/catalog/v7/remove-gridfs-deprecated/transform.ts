import type { API, FileInfo, ObjectProperty, Identifier, StringLiteral, ImportSpecifier } from 'jscodeshift';

const REMOVED_OPTIONS = new Set(['contentType', 'aliases']);
const GRIDFS_IDENTIFIERS = new Set(['GridFSBucket', 'GridFSBucketWriteStream', 'GridFSBucketWriteStreamOptions']);

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);

  const hasGridFSImport = root
    .find(j.ImportDeclaration, { source: { value: 'mongodb' } })
    .some(path =>
      path.node.specifiers?.some(
        s => s.type === 'ImportSpecifier' && GRIDFS_IDENTIFIERS.has(((s as ImportSpecifier).imported as Identifier).name)
      ) ?? false
    );

  if (!hasGridFSImport) return undefined;

  let dirty = false;

  root.find(j.ObjectExpression).forEach(path => {
    const before = path.node.properties.length;
    path.node.properties = path.node.properties.filter(prop => {
      if (prop.type !== 'ObjectProperty') return true;
      const key = (prop as ObjectProperty).key;
      const name = key.type === 'Identifier' ? (key as Identifier).name
                 : key.type === 'StringLiteral' ? (key as StringLiteral).value
                 : null;
      return name === null || !REMOVED_OPTIONS.has(name);
    });
    if (path.node.properties.length < before) dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
