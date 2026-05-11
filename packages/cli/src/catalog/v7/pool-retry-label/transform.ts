import type { API, FileInfo } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.StringLiteral, { value: 'PoolRequstedRetry' }).forEach(path => {
    j(path).replaceWith(j.stringLiteral('PoolRequestedRetry'));
    dirty = true;
  });

  return dirty ? root.toSource({ quote: 'single' }) : undefined;
}
