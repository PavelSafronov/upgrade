import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { detect } from './detect.js';
import { buildPlan } from './plan.js';
import { getCatalog } from './catalog/index.js';
import { runCodemods, runEnvChecks } from './runner.js';

const CORPUS_ROOT = join(import.meta.dirname, '../test/corpus');

async function dryRunCorpus(name: string) {
  const dir = join(CORPUS_ROOT, name);
  const detected = detect(dir);
  if (!detected) throw new Error(`No mongodb version detected in ${dir}`);

  const plan = buildPlan(detected.current);
  const catalog = getCatalog();
  const applicable = catalog.filter(c => plan.some(h => h.from === c.hop.from));

  const codemods = applicable.filter(c => c.kind !== 'env');
  const envCodemods = applicable.filter(c => c.kind === 'env');

  const allChanges = [
    ...await runCodemods(codemods, dir, { dryRun: true }),
    ...await runEnvChecks(envCodemods, dir, { dryRun: true }),
  ];

  return allChanges
    .filter(c => c.status !== 'nothing-to-do')
    .map(c => ({
      codemod: c.codemod,
      file: c.file.replace(dir + '/', ''),
      status: c.status,
    }))
    .sort((a, b) => a.codemod.localeCompare(b.codemod) || a.file.localeCompare(b.file));
}

describe('corpus regression guard', () => {
  it('mongoose (v6 → v7): dry-run output matches snapshot', async () => {
    const result = await dryRunCorpus('mongoose');
    expect(result).toMatchSnapshot();
  });

  it('loopback-connector-mongodb (v5 → v7, two-hop): dry-run output matches snapshot', async () => {
    const result = await dryRunCorpus('loopback-connector-mongodb');
    expect(result).toMatchSnapshot();
  });

  it('parse-server (v6, Flow files): dry-run output matches snapshot', async () => {
    const result = await dryRunCorpus('parse-server');
    expect(result).toMatchSnapshot();
  });
});
