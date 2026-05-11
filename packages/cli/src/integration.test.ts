import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cpSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detect } from './detect.js';
import { buildPlan } from './plan.js';
import { getCatalog } from './catalog/index.js';
import { runCodemods, runEnvChecks } from './runner.js';
import { buildReport } from './report.js';

const TEST_APP_V6 = join(import.meta.dirname, '../../test-app-v6');

describe('CLI integration — test-app-v6', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `integration-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V6, tmp, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('detects mongodb@6.20.0', () => {
    const result = detect(tmp);
    expect(result).toEqual({ package: 'mongodb', current: '6.20.0' });
  });

  it('plans a single hop 6.x → 7.x', () => {
    const result = detect(tmp)!;
    const plan = buildPlan(result.current);
    expect(plan).toEqual([{ from: '6.x', to: '7.x' }]);
  });

  it('applies all mechanical transforms without error', async () => {
    const codemods = getCatalog().filter(c => c.kind === 'mechanical');
    const changes = await runCodemods(codemods, tmp, { dryRun: false });
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(c => c.status === 'applied')).toBe(true);
  });

  it('generates a report with mechanical and flagged entries', async () => {
    const codemods = getCatalog();
    const mechanical = codemods.filter(c => c.kind === 'mechanical');
    const semantic = codemods.filter(c => c.kind === 'semantic');
    const changes = [
      ...await runCodemods(mechanical, tmp, { dryRun: false }),
      ...await runCodemods(semantic, tmp, { dryRun: false }),
    ];
    const report = buildReport('mongodb', '6.20.0', '7.x', changes);
    expect(report.summary.mechanical).toBeGreaterThan(0);
    expect(report.summary.flagged).toBeGreaterThan(0);
  });

  it('bumps mongodb dep to ^7.0.0 via env check', async () => {
    const codemods = getCatalog().filter(c => c.id === 'mongodb-dep-bump');
    await runEnvChecks(codemods, tmp, { dryRun: false });
    const pkg = JSON.parse(readFileSync(join(tmp, 'package.json'), 'utf8'));
    expect(pkg.dependencies.mongodb).toBe('^7.0.0');
  });
});
