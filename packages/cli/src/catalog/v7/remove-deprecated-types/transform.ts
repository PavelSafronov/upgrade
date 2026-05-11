import type { API, FileInfo, ImportSpecifier, Identifier } from 'jscodeshift';

const REMOVED_TYPES = new Set([
  'CloseOptions', 'ResumeOptions', 'CancellationToken', 'Transaction',
  'ServerCapabilities', 'ClientMetadataOptions', 'FindOneOptions',
]);

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.ImportDeclaration)
    .filter(path =>
      path.node.source.value === 'mongodb' ||
      path.node.source.value === 'mongodb/beta'
    )
    .forEach(path => {
      const before = path.node.specifiers?.length ?? 0;
      path.node.specifiers = (path.node.specifiers ?? []).filter(s => {
        if (s.type !== 'ImportSpecifier') return true;
        const name = (s as ImportSpecifier).imported.type === 'Identifier'
          ? ((s as ImportSpecifier).imported as Identifier).name
          : null;
        return name === null || !REMOVED_TYPES.has(name);
      });
      const after = path.node.specifiers.length;
      if (after < before) {
        dirty = true;
        if (after === 0) j(path).remove();
      }
    });

  return dirty ? root.toSource() : undefined;
}
