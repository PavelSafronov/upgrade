import { detect } from '@pavel-safronov/upgrade/detect';
import { buildPlan } from '@pavel-safronov/upgrade/plan';
import { getCatalog } from '@pavel-safronov/upgrade/catalog/index';
import { runCodemods } from '@pavel-safronov/upgrade/runner';

export interface AnalyzeResult {
  package: string;
  currentVersion: string;
  plan: Array<{ from: string; to: string }>;
  codemods: Array<{ id: string; kind: string; description: string }>;
  fileBreakdown: Array<{ file: string; codemods: string[] }>;
}

export async function analyzeRepo({ path, to = '7' }: { path: string; to?: string }): Promise<AnalyzeResult> {
  const detected = detect(path);
  if (!detected) throw new Error(`Could not detect mongodb version in ${path}/package.json`);

  const plan = buildPlan(detected.current, to);
  const codemods = getCatalog().filter(c =>
    plan.some(hop => hop.from === c.hop.from)
  );

  const changes = await runCodemods(
    codemods.filter(c => c.kind !== 'env'),
    path,
    { dryRun: true }
  );

  const byFile = new Map<string, string[]>();
  for (const change of changes) {
    const list = byFile.get(change.file) ?? [];
    list.push(change.codemod);
    byFile.set(change.file, list);
  }

  return {
    package: detected.package,
    currentVersion: detected.current,
    plan,
    codemods: codemods.map(c => ({ id: c.id, kind: c.kind, description: c.description })),
    fileBreakdown: [...byFile.entries()].map(([file, cmds]) => ({ file, codemods: cmds })),
  };
}
