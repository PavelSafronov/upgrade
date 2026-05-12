import type { API, FileInfo } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.Identifier, { name: 'ObjectID' }).forEach(path => {
    path.node.name = 'ObjectId';
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
