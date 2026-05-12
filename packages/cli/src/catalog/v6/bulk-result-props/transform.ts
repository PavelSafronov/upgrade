import type { API, FileInfo } from 'jscodeshift';

const REMOVED_PROPS: Array<{ name: string; replacement: string }> = [
  { name: 'nInserted',  replacement: 'insertedCount' },
  { name: 'nUpserted',  replacement: 'upsertedCount' },
  { name: 'nMatched',   replacement: 'matchedCount'  },
  { name: 'nModified',  replacement: 'modifiedCount' },
  { name: 'nRemoved',   replacement: 'deletedCount'  },
];

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  for (const { name, replacement } of REMOVED_PROPS) {
    root
      .find(j.MemberExpression, {
        property: { type: 'Identifier', name },
      })
      .forEach(path => {
        let stmtPath: any = path;
        while (stmtPath.parent && !j.Statement.check(stmtPath.parent.node)) {
          stmtPath = stmtPath.parent;
        }
        const stmtNode = stmtPath.parent ? stmtPath.parent.node : stmtPath.node;
        const comment: any = {
          type: 'CommentLine',
          value: ` TODO(mongodb-upgrade): BulkWriteResult.${name} removed in v6. Use .${replacement} instead.`,
          leading: true,
          trailing: false,
        };
        stmtNode.comments = [...(stmtNode.comments ?? []), comment];
        j(path).replaceWith(j.identifier('undefined'));
        dirty = true;
      });
  }

  return dirty ? root.toSource() : undefined;
}
