import type { API, FileInfo, Identifier } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.TSTypeReference)
    .filter(path => {
      const name = path.node.typeName;
      return name.type === 'Identifier' && (name as Identifier).name === 'FindOptions';
    })
    .filter(path => (path.node.typeParameters?.params?.length ?? 0) > 0)
    .forEach(path => {
      path.node.typeParameters = undefined;
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}
