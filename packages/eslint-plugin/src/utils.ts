import type { Rule, SourceCode } from 'eslint';

export function isMongoDBSource(source: string): boolean {
  return source === 'mongodb' || source === 'mongodb/beta';
}

export function removeNode(
  fixer: Rule.RuleFixer,
  node: any,
  sourceCode: SourceCode,
): Rule.Fix {
  const tokenBefore = sourceCode.getTokenBefore(node);
  const tokenAfter = sourceCode.getTokenAfter(node);
  if (tokenAfter?.value === ',') {
    return fixer.removeRange([node.range[0], tokenAfter.range[1]]);
  }
  if (tokenBefore?.value === ',') {
    return fixer.removeRange([tokenBefore.range[0], node.range[1]]);
  }
  return fixer.remove(node);
}

export function removeImportSpecifier(
  fixer: Rule.RuleFixer,
  specifier: any,
  importDecl: any,
  sourceCode: SourceCode,
): Rule.Fix {
  if ((importDecl.specifiers ?? []).length === 1) {
    return fixer.remove(importDecl);
  }
  return removeNode(fixer, specifier, sourceCode);
}
