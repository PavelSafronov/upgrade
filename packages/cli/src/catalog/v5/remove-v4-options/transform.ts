import type { API, FileInfo, ObjectProperty, Identifier, StringLiteral } from 'jscodeshift';

const REMOVED_OPTIONS = new Set(['slaveOk', 'promiseLibrary', 'keepGoing']);

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
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
