import type { API, FileInfo } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.ImportDeclaration, { source: { value: 'mongodb/beta' } }).forEach(path => {
    path.node.source = j.stringLiteral('mongodb');
    dirty = true;
  });

  return dirty ? root.toSource({ quote: 'single' }) : undefined;
}
