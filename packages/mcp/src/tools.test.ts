import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeRepo } from './tools/analyze-repo.js';
import { applyCodemod } from './tools/apply-codemod.js';
import { explainBreakingChange } from './tools/explain-breaking-change.js';

const TEST_APP_V6 = join(import.meta.dirname, '../../test-app-v6');
const TEST_APP_V4 = join(import.meta.dirname, '../../test-app-v4');

describe('analyzeRepo', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `mcp-analyze-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('returns version, plan, codemods, and fileBreakdown for test-app-v6', async () => {
    cpSync(TEST_APP_V6, tmp, { recursive: true });
    const result = await analyzeRepo({ path: tmp });
    expect(result.package).toBe('mongodb');
    expect(result.currentVersion).toBe('6.20.0');
    expect(result.plan).toEqual([{ from: '6.x', to: '7.x' }]);
    expect(result.codemods.length).toBeGreaterThan(0);
    expect(result.fileBreakdown.length).toBeGreaterThan(0);
  });

  it('returns three-hop plan and includes v5 codemods for test-app-v4', async () => {
    cpSync(TEST_APP_V4, tmp, { recursive: true });
    const result = await analyzeRepo({ path: tmp });
    expect(result.plan).toEqual([
      { from: '4.x', to: '5.x' },
      { from: '5.x', to: '6.x' },
      { from: '6.x', to: '7.x' },
    ]);
    expect(result.codemods.some(c => c.id === 'objectid-rename')).toBe(true);
  });

  it('throws when mongodb is not detected', async () => {
    writeFileSync(
      join(tmp, 'package.json'),
      JSON.stringify({ name: 'no-mongo', version: '1.0.0', dependencies: {} })
    );
    await expect(analyzeRepo({ path: tmp })).rejects.toThrow('Could not detect mongodb version');
  });
});

describe('applyCodemod', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `mcp-apply-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V6, tmp, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('returns changes for codemod: "all" in dry-run mode', async () => {
    const result = await applyCodemod({ path: tmp, codemod: 'all', dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.summary.applied + result.summary.flagged).toBeGreaterThan(0);
  });

  it('returns changes for a named codemod in dry-run mode', async () => {
    const result = await applyCodemod({ path: tmp, codemod: 'stream-transform', dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('throws for an unknown codemod id', async () => {
    await expect(
      applyCodemod({ path: tmp, codemod: 'nonexistent' })
    ).rejects.toThrow('Unknown codemod: nonexistent');
  });
});

describe('explainBreakingChange', () => {
  it('returns full result for a known v7 codemod', () => {
    const result = explainBreakingChange({ id: 'stream-transform' });
    expect(result.id).toBe('stream-transform');
    expect(result.kind).toBe('mechanical');
    expect(result.hop).toEqual({ from: '6.x', to: '7.x' });
    expect(result.before).toContain('stream');
    expect(result.after).toContain('stream');
    expect(result.notes).toBeTruthy();
    expect(result.docsUrl).toBeTruthy();
  });

  it('throws for an unknown id', () => {
    expect(() => explainBreakingChange({ id: 'nonexistent' })).toThrow('Unknown codemod: nonexistent');
  });

  it('returns before/after example for a v5 codemod (objectid-rename)', () => {
    const result = explainBreakingChange({ id: 'objectid-rename' });
    expect(result.hop).toEqual({ from: '4.x', to: '5.x' });
    expect(result.before).toContain('ObjectID');
    expect(result.after).toContain('ObjectId');
    expect(result.before).not.toBe('(no example available)');
  });

  it('returns before/after example for a v6 codemod (bulk-result-props)', () => {
    const result = explainBreakingChange({ id: 'bulk-result-props' });
    expect(result.hop).toEqual({ from: '5.x', to: '6.x' });
    expect(result.before).toContain('nInserted');
    expect(result.after).toContain('insertedCount');
    expect(result.before).not.toBe('(no example available)');
  });
});
