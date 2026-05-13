import type { API, FileInfo, ObjectExpression, ObjectProperty, Identifier, Expression, MemberExpression } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'stream' } },
    })
    .filter(path => {
      if (path.node.arguments.length !== 1) return false;
      const arg = path.node.arguments[0];
      if (arg.type !== 'ObjectExpression') return false;
      return (arg as ObjectExpression).properties.some(
        p => p.type === 'ObjectProperty' &&
             (p as ObjectProperty).key.type === 'Identifier' &&
             ((p as ObjectProperty).key as Identifier).name === 'transform'
      );
    })
    .forEach(path => {
      const arg = path.node.arguments[0] as ObjectExpression;
      const transformProp = arg.properties.find(
        p => p.type === 'ObjectProperty' &&
             (p as ObjectProperty).key.type === 'Identifier' &&
             ((p as ObjectProperty).key as Identifier).name === 'transform'
      ) as ObjectProperty;

      const remainingProps = arg.properties.filter(
        p => !(p.type === 'ObjectProperty' &&
               (p as ObjectProperty).key.type === 'Identifier' &&
               ((p as ObjectProperty).key as Identifier).name === 'transform')
      );

      const streamArgs = remainingProps.length > 0
        ? [j.objectExpression(remainingProps as any[])]
        : [];

      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(
            j.callExpression(path.node.callee as MemberExpression, streamArgs),
            j.identifier('map')
          ),
          [transformProp.value] as any[]
        )
      );
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}
