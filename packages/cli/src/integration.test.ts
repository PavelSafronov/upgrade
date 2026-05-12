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
const TEST_APP_V5 = join(import.meta.dirname, '../../test-app-v5');
const TEST_APP_V4 = join(import.meta.dirname, '../../test-app-v4');
const TEST_APP_V4_2 = join(import.meta.dirname, '../../test-app-v4.2');

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

describe('CLI integration — test-app-v5', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `integration-test-v5-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V5, tmp, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('detects mongodb@5.8.1', () => {
    const result = detect(tmp);
    expect(result).toEqual({ package: 'mongodb', current: '5.8.1' });
  });

  it('plans two hops 5.x → 6.x → 7.x', () => {
    const result = detect(tmp)!;
    const plan = buildPlan(result.current);
    expect(plan).toEqual([
      { from: '5.x', to: '6.x' },
      { from: '6.x', to: '7.x' },
    ]);
  });

  it('applies all v6 mechanical transforms without error', async () => {
    const codemods = getCatalog().filter(c => c.kind === 'mechanical' && c.hop.from === '5.x');
    const changes = await runCodemods(codemods, tmp, { dryRun: false });
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(c => c.status === 'applied')).toBe(true);
  });

  it('generates a report with mechanical and flagged entries for the v5 hop', async () => {
    const codemods = getCatalog().filter(c => c.hop.from === '5.x');
    const mechanical = codemods.filter(c => c.kind === 'mechanical');
    const semantic = codemods.filter(c => c.kind === 'semantic');
    const changes = [
      ...await runCodemods(mechanical, tmp, { dryRun: false }),
      ...await runCodemods(semantic, tmp, { dryRun: false }),
    ];
    const report = buildReport('mongodb', '5.8.1', '6.x', changes);
    expect(report.summary.mechanical).toBeGreaterThan(0);
    expect(report.summary.flagged).toBeGreaterThan(0);
  });

  it('bumps mongodb dep to ^6.0.0 via env check', async () => {
    const codemods = getCatalog().filter(c => c.id === 'mongodb-dep-bump-v6');
    await runEnvChecks(codemods, tmp, { dryRun: false });
    const pkg = JSON.parse(readFileSync(join(tmp, 'package.json'), 'utf8'));
    expect(pkg.dependencies.mongodb).toBe('^6.0.0');
  });
});

describe('transform output — v6 mechanical', () => {
  let tmp: string;
  let transformed: string;

  beforeAll(async () => {
    tmp = join(tmpdir(), `v6-mechanical-output-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V5, tmp, { recursive: true });
    const codemods = getCatalog().filter(c => c.kind === 'mechanical' && c.hop.from === '5.x');
    await runCodemods(codemods, tmp, { dryRun: false });
    transformed = readFileSync(join(tmp, 'src', 'index.ts'), 'utf8');
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('remove-connection-options-v6: removes sslValidate, sslPass from connectWithSsl', () => {
    expect(transformed).not.toContain('sslValidate:');
    expect(transformed).not.toContain('sslPass:');
    expect(transformed).toContain('maxPoolSize');
  });

  it('remove-connection-options-v6: removes sslCA, sslCert, sslKey from SSL_CLIENT_OPTIONS', () => {
    expect(transformed).not.toContain('sslCA:');
    expect(transformed).not.toContain('sslCert:');
    expect(transformed).not.toContain('sslKey:');
  });

  it('remove-connection-options-v6: removes keepAlive and keepAliveInitialDelay', () => {
    expect(transformed).not.toContain('keepAlive:');
    expect(transformed).not.toContain('keepAliveInitialDelay:');
  });

  it('bulk-result-props: replaces nInserted with undefined + TODO', () => {
    expect(transformed).not.toMatch(/result\.nInserted/);
    expect(transformed).toContain('TODO(mongodb-upgrade): BulkWriteResult.nInserted removed in v6');
  });
});

describe('transform output — v6 semantic', () => {
  let tmp: string;
  let transformed: string;

  beforeAll(async () => {
    tmp = join(tmpdir(), `v6-semantic-output-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V5, tmp, { recursive: true });
    const codemods = getCatalog().filter(c => c.kind === 'semantic' && c.hop.from === '5.x');
    await runCodemods(codemods, tmp, { dryRun: false });
    transformed = readFileSync(join(tmp, 'src', 'index.ts'), 'utf8');
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('db-adduser-removed: inserts TODO before addUser call', () => {
    expect(transformed).toContain('TODO(mongodb-upgrade): db.addUser() has been removed in v6');
  });

  it('collection-stats-removed: inserts TODO before stats call', () => {
    expect(transformed).toContain('TODO(mongodb-upgrade): collection.stats() has been removed in v6');
  });

  it('findoneand-metadata: inserts TODO before findOneAndUpdate without includeResultMetadata', () => {
    expect(transformed).toContain('TODO(mongodb-upgrade): findOneAndUpdate() now returns the document directly');
  });

  it('withtransaction-return: inserts TODO when return value is used', () => {
    expect(transformed).toContain('TODO(mongodb-upgrade): withTransaction() always returns void in v6');
  });
});

describe('CLI integration — test-app-v4', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `integration-test-v4-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V4, tmp, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('detects mongodb@4.13.0', () => {
    const result = detect(tmp);
    expect(result).toEqual({ package: 'mongodb', current: '4.13.0' });
  });

  it('plans three hops 4.x → 5.x → 6.x → 7.x', () => {
    const result = detect(tmp)!;
    const plan = buildPlan(result.current);
    expect(plan).toEqual([
      { from: '4.x', to: '5.x' },
      { from: '5.x', to: '6.x' },
      { from: '6.x', to: '7.x' },
    ]);
  });

  it('applies all v5 mechanical transforms without error', async () => {
    const codemods = getCatalog().filter(c => c.kind === 'mechanical' && c.hop.from === '4.x');
    const changes = await runCodemods(codemods, tmp, { dryRun: false });
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(c => c.status === 'applied')).toBe(true);
  });

  it('generates a report with mechanical and flagged entries for the v4 hop', async () => {
    const codemods = getCatalog().filter(c => c.hop.from === '4.x');
    const mechanical = codemods.filter(c => c.kind === 'mechanical');
    const semantic = codemods.filter(c => c.kind === 'semantic');
    const changes = [
      ...await runCodemods(mechanical, tmp, { dryRun: false }),
      ...await runCodemods(semantic, tmp, { dryRun: false }),
    ];
    const report = buildReport('mongodb', '4.13.0', '5.x', changes);
    expect(report.summary.mechanical).toBeGreaterThan(0);
    expect(report.summary.flagged).toBeGreaterThan(0);
  });

  it('bumps mongodb dep to ^5.0.0 via env check', async () => {
    const codemods = getCatalog().filter(c => c.id === 'mongodb-dep-bump-v5');
    await runEnvChecks(codemods, tmp, { dryRun: false });
    const pkg = JSON.parse(readFileSync(join(tmp, 'package.json'), 'utf8'));
    expect(pkg.dependencies.mongodb).toBe('^5.0.0');
  });
});

describe('transform output — v5 mechanical', () => {
  let tmp: string;
  let transformed: string;

  beforeAll(async () => {
    tmp = join(tmpdir(), `v5-mechanical-output-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V4, tmp, { recursive: true });
    const codemods = getCatalog().filter(c => c.kind === 'mechanical' && c.hop.from === '4.x');
    await runCodemods(codemods, tmp, { dryRun: false });
    transformed = readFileSync(join(tmp, 'src', 'index.ts'), 'utf8');
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('objectid-rename: renames ObjectID to ObjectId in import and usage', () => {
    expect(transformed).not.toContain('ObjectID');
    expect(transformed).toContain('ObjectId');
  });

  it('remove-v4-options: removes slaveOk from SLAVE_OK_OPTIONS', () => {
    expect(transformed).not.toContain('slaveOk:');
    expect(transformed).toContain('maxPoolSize');
  });

  it('remove-v4-options: removes promiseLibrary from connectWithPromiseLibrary', () => {
    expect(transformed).not.toContain('promiseLibrary:');
  });

  it('remove-v4-options: removes keepGoing from bulkWriteWithKeepGoing', () => {
    expect(transformed).not.toContain('keepGoing:');
  });
});

describe('transform output — v5 semantic', () => {
  let tmp: string;
  let transformed: string;

  beforeAll(async () => {
    tmp = join(tmpdir(), `v5-semantic-output-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V4, tmp, { recursive: true });
    const codemods = getCatalog().filter(c => c.kind === 'semantic' && c.hop.from === '4.x');
    await runCodemods(codemods, tmp, { dryRun: false });
    transformed = readFileSync(join(tmp, 'src', 'index.ts'), 'utf8');
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('legacy-collection-methods: inserts TODO before .insert() call', () => {
    expect(transformed).toContain('TODO(mongodb-upgrade): collection.insert() has been removed in v5');
  });

  it('legacy-collection-methods: inserts TODO before .update() call', () => {
    expect(transformed).toContain('TODO(mongodb-upgrade): collection.update() has been removed in v5');
  });

  it('legacy-collection-methods: inserts TODO before .remove() call', () => {
    expect(transformed).toContain('TODO(mongodb-upgrade): collection.remove() has been removed in v5');
  });

  it('mapreduece-removed: inserts TODO before .mapReduce() call', () => {
    expect(transformed).toContain('TODO(mongodb-upgrade): collection.mapReduce() has been removed in v5');
  });

  it('callback-api: inserts TODO before callback-style .findOne() call', () => {
    expect(transformed).toContain('TODO(mongodb-upgrade): Callback-based .findOne() has been removed in v5');
  });
});

describe('CLI integration — test-app-v4.2', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `integration-test-v4-2-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    cpSync(TEST_APP_V4_2, tmp, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('detects mongodb@4.2.0', () => {
    const result = detect(tmp);
    expect(result).toEqual({ package: 'mongodb', current: '4.2.0' });
  });

  it('plans three hops 4.x → 5.x → 6.x → 7.x', () => {
    const result = detect(tmp)!;
    const plan = buildPlan(result.current);
    expect(plan).toEqual([
      { from: '4.x', to: '5.x' },
      { from: '5.x', to: '6.x' },
      { from: '6.x', to: '7.x' },
    ]);
  });

  it('applies v5 mechanical transforms without error', async () => {
    const codemods = getCatalog().filter(c => c.kind === 'mechanical' && c.hop.from === '4.x');
    const changes = await runCodemods(codemods, tmp, { dryRun: false });
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(c => c.status === 'applied')).toBe(true);
  });
});
