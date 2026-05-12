import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
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

describe('transform output — mechanical', () => {
  let tmp: string;
  let transformed: string;

  beforeAll(async () => {
    tmp = join(tmpdir(), `output-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V6, tmp, { recursive: true });
    const codemods = getCatalog().filter(c => c.kind === 'mechanical');
    await runCodemods(codemods, tmp, { dryRun: false });
    transformed = readFileSync(join(tmp, 'src', 'index.ts'), 'utf8');
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('stream-transform: rewrites stream({transform}) to stream().map()', () => {
    expect(transformed).not.toMatch(/\.stream\(\s*\{\s*transform:/);
    expect(transformed).toContain('cursor.stream().map(JSON.stringify)');
  });

  it('pool-retry-label: fixes PoolRequstedRetry typo to PoolRequestedRetry', () => {
    expect(transformed).not.toContain('PoolRequstedRetry');
    expect(transformed).toContain('PoolRequestedRetry');
  });

  it('remove-client-options: removes useNewUrlParser and useUnifiedTopology', () => {
    expect(transformed).not.toContain('useNewUrlParser');
    expect(transformed).not.toContain('useUnifiedTopology');
    // Other options are preserved
    expect(transformed).toContain('maxPoolSize');
  });

  it('remove-deprecated-types: strips deprecated imports from mongodb import block', () => {
    const mongoImport = transformed.match(/import\s*\{[\s\S]*?\}\s*from\s*['"]mongodb['"]/)?.[0] ?? '';
    expect(mongoImport).not.toContain('CloseOptions');
    expect(mongoImport).not.toContain('CancellationToken');
    expect(mongoImport).not.toContain('ResumeOptions');
    expect(mongoImport).not.toContain('ServerCapabilities');
    expect(mongoImport).not.toContain('ClientMetadataOptions');
    expect(mongoImport).toContain('MongoClient');
  });

  it('remove-gridfs-deprecated: removes contentType and aliases, keeps chunkSizeBytes', () => {
    expect(transformed).not.toContain('contentType:');
    expect(transformed).not.toContain("aliases:");
    expect(transformed).toContain('chunkSizeBytes:');
  });

  it('find-options-generic: removes type parameter from FindOptions<T>', () => {
    expect(transformed).not.toMatch(/FindOptions</);
    expect(transformed).toContain('FindOptions');
  });

  it('remove-property-access: replaces ReadPreference.minWireVersion with undefined + TODO', () => {
    // The member expressions must not appear as code (they survive only inside the TODO comment text)
    expect(transformed).not.toMatch(/=\s*ReadPreference\.minWireVersion/);
    expect(transformed).not.toMatch(/=\s*session\.transaction/);
    expect(transformed).toContain('TODO(mongodb-upgrade): ReadPreference.minWireVersion removed in v7');
    expect(transformed).toContain('TODO(mongodb-upgrade): session.transaction removed in v7');
  });
});

describe('transform output — semantic', () => {
  let tmp: string;
  let transformed: string;

  beforeAll(async () => {
    tmp = join(tmpdir(), `semantic-output-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V6, tmp, { recursive: true });
    const codemods = getCatalog().filter(c => c.kind === 'semantic');
    await runCodemods(codemods, tmp, { dryRun: false });
    transformed = readFileSync(join(tmp, 'src', 'index.ts'), 'utf8');
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('aws-explicit-credentials: inserts TODO before MONGODB-AWS URI with credentials', () => {
    expect(transformed).toContain(
      'TODO(mongodb-upgrade): MONGODB-AWS no longer accepts explicit credentials in the URI.'
    );
  });

  it('mongodb-cr-auth: inserts TODO before MONGODB-CR authMechanism', () => {
    expect(transformed).toContain(
      'TODO(mongodb-upgrade): MONGODB-CR auth mechanism has been removed.'
    );
  });

  it('client-metadata-props: inserts TODO before additionalDriverInfo access', () => {
    expect(transformed).toContain(
      'TODO(mongodb-upgrade): additionalDriverInfo is no longer part of the public API.'
    );
  });

  it('cursor-implicit-batch-size: inserts TODO before batchSize: 1000', () => {
    expect(transformed).toContain(
      'TODO(mongodb-upgrade): batchSize: 1000 may have been compensating'
    );
  });
});
