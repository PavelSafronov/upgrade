import { detect } from '@pavel-safronov/upgrade/detect';
import { buildPlan } from '@pavel-safronov/upgrade/plan';
import { getCatalog, getById } from '@pavel-safronov/upgrade/catalog/index';
import { runCodemods, runEnvChecks } from '@pavel-safronov/upgrade/runner';
import type { Change } from '@pavel-safronov/upgrade/runner';

export interface ApplyResult {
  dryRun: boolean;
  changes: Change[];
  summary: { applied: number; flagged: number };
}

export async function applyCodemod({
  path,
  codemod,
  dryRun = false,
}: {
  path: string;
  codemod: string;
  dryRun?: boolean;
}): Promise<ApplyResult> {
  const detected = detect(path);
  if (!detected) throw new Error(`Could not detect mongodb version in ${path}/package.json`);

  let codemods;
  if (codemod === 'all') {
    const plan = buildPlan(detected.current);
    codemods = getCatalog().filter(c => plan.some(hop => hop.from === c.hop.from));
  } else {
    const found = getById(codemod);
    if (!found) throw new Error(`Unknown codemod: ${codemod}. Run analyze_repo to see available codemods.`);
    codemods = [found];
  }

  const changes: Change[] = [
    ...await runCodemods(codemods.filter(c => c.kind !== 'env'), path, { dryRun }),
    ...await runEnvChecks(codemods.filter(c => c.kind === 'env'), path, { dryRun }),
  ];

  return {
    dryRun,
    changes,
    summary: {
      applied: changes.filter(c => c.status === 'applied').length,
      flagged: changes.filter(c => c.status === 'flagged').length,
    },
  };
}
