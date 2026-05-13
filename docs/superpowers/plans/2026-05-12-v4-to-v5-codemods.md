# v4→v5 Codemods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full v4→v5 upgrade hop — transforms, env checks, test-app fixture, behavioral tests, and CLI integration tests — so the tool covers mongodb@4.x users.

**Architecture:** Identical structure to the v5→v6 and v6→v7 hops already in the repo: mechanical transforms in `packages/cli/src/catalog/v5/<name>/transform.ts`, semantic transforms combined in `packages/cli/src/catalog/v5/semantic/transform.ts`, env checks in `packages/cli/src/env/v5.ts`. The test fixture in `packages/test-app-v4` gets a populated `src/index.ts`, a behavioral test suite, and vitest+mongodb-memory-server in devDependencies. CLI integration tests mirror the v5 describe blocks already in `packages/cli/src/integration.test.ts`.

**Tech Stack:** jscodeshift (AST transforms), vitest, mongodb-memory-server, Node.js 20.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/test-app-v4/src/index.ts` | Populate with v4→v5 deprecated patterns |
| Modify | `packages/test-app-v4/package.json` | Add `type:module`, vitest, mongodb-memory-server |
| Create | `packages/test-app-v4/src/index.test.ts` | Behavioral tests (real MongoDB) |
| Create | `packages/cli/src/catalog/v5/objectid-rename/transform.ts` | Rename ObjectID → ObjectId everywhere |
| Create | `packages/cli/src/catalog/v5/remove-v4-options/transform.ts` | Remove slaveOk, promiseLibrary, keepGoing |
| Create | `packages/cli/src/catalog/v5/semantic/transform.ts` | Flag legacy methods, mapReduce, callback API |
| Create | `packages/cli/src/catalog/v5/index.ts` | Register v5 codemods |
| Create | `packages/cli/src/env/v5.ts` | Env checks (dep bump to ^5.0.0, node version) |
| Modify | `packages/cli/src/catalog/index.ts` | Import v5Codemods and spread into catalog |
| Modify | `packages/cli/src/integration.test.ts` | Add v4 detection, plan, and output test suites |

---

## Task 1: Populate test-app-v4 fixture

**Files:**
- Modify: `packages/test-app-v4/src/index.ts`
- Modify: `packages/test-app-v4/package.json`

- [ ] **Step 1: Replace the stub index.ts**

Replace entire contents of `packages/test-app-v4/src/index.ts`:

```typescript
import { MongoClient, ObjectID } from 'mongodb';

// --- Mechanical: objectid-rename ---
export const legacyId = new ObjectID('507f1f77bcf86cd799439011');

export function findById(client: MongoClient, id: ObjectID) {
  return client.db('test').collection('items').findOne({ _id: id as any });
}

// --- Mechanical: remove-v4-options (slaveOk) ---
export function connectWithSlaveOk(uri: string) {
  return new MongoClient(uri, {
    slaveOk: true,
    maxPoolSize: 5,
  } as any);
}

// --- Mechanical: remove-v4-options (promiseLibrary) ---
export function connectWithPromiseLibrary(uri: string) {
  return new MongoClient(uri, {
    promiseLibrary: Promise,
    maxPoolSize: 5,
  } as any);
}

// --- Mechanical: remove-v4-options (keepGoing) ---
export async function bulkWriteWithKeepGoing(client: MongoClient) {
  return client
    .db('test')
    .collection('items')
    .bulkWrite([{ insertOne: { document: { x: 1 } } }], { keepGoing: true } as any);
}

// --- Semantic: legacy-collection-methods ---
export async function insertExample(client: MongoClient) {
  return (client.db('test').collection('items') as any).insert({ x: 1 });
}

export async function updateExample(client: MongoClient) {
  return (client.db('test').collection('items') as any).update({ x: 1 }, { $set: { x: 2 } });
}

export async function removeExample(client: MongoClient) {
  return (client.db('test').collection('items') as any).remove({ x: 1 });
}

// --- Semantic: mapreduece-removed ---
export async function mapReduceExample(client: MongoClient) {
  return (client.db('test').collection('items') as any).mapReduce(
    'function() { emit(this.x, 1); }',
    'function(key, values) { return values.length; }',
    { out: { inline: 1 } }
  );
}

// --- Semantic: callback-api ---
export function findWithCallback(client: MongoClient) {
  (client.db('test').collection('items') as any).findOne({ x: 1 }, (err: any, doc: any) => {
    console.log(doc);
  });
}
```

- [ ] **Step 2: Update package.json**

Replace entire contents of `packages/test-app-v4/package.json`:

```json
{
  "name": "test-app-v4",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Kitchen-sink app using every mongodb v4 deprecated API — used as CLI upgrade demo target",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "mongodb": "4.13.0"
  },
  "devDependencies": {
    "mongodb-memory-server": "^9.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Install deps**

```bash
npm install
```

Expected: lockfile updated, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/test-app-v4/src/index.ts packages/test-app-v4/package.json package-lock.json
git commit -m "chore(test-app-v4): populate deprecated v4 patterns and add vitest"
```

---

## Task 2: Behavioral tests for test-app-v4

**Files:**
- Create: `packages/test-app-v4/src/index.test.ts`

- [ ] **Step 1: Create the test file**

Create `packages/test-app-v4/src/index.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import {
  legacyId,
  findById,
  connectWithSlaveOk,
  connectWithPromiseLibrary,
  bulkWriteWithKeepGoing,
  insertExample,
} from './index.js';

let mongod: MongoMemoryServer;
let client: MongoClient;

// First run downloads the MongoDB binary (~60 MB) — subsequent runs are fast.
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  client = new MongoClient(mongod.getUri());
  await client.connect();
}, 120_000);

afterAll(async () => {
  await client.close();
  await mongod.stop();
});

describe('legacyId', () => {
  it('is an ObjectID instance (ObjectId alias in v4)', () => {
    expect(legacyId).toBeDefined();
    expect(legacyId.toHexString()).toBe('507f1f77bcf86cd799439011');
  });
});

describe('findById', () => {
  it('returns null when no matching doc', async () => {
    const result = await findById(client, legacyId as any);
    expect(result).toBeNull();
  });
});

describe('connectWithSlaveOk', () => {
  it('returns a MongoClient (slaveOk option silently ignored in v4)', () => {
    const c = connectWithSlaveOk('mongodb://localhost:27017');
    expect(c).toBeInstanceOf(MongoClient);
  });
});

describe('connectWithPromiseLibrary', () => {
  it('returns a MongoClient (promiseLibrary option silently ignored in v4)', () => {
    const c = connectWithPromiseLibrary('mongodb://localhost:27017');
    expect(c).toBeInstanceOf(MongoClient);
  });
});

describe('bulkWriteWithKeepGoing', () => {
  it('returns a BulkWriteResult', async () => {
    const result = await bulkWriteWithKeepGoing(client);
    expect(result).toBeDefined();
    expect(typeof result.insertedCount).toBe('number');
  });
});

describe('insertExample', () => {
  it('inserts a document (deprecated .insert() in v4)', async () => {
    const result = await insertExample(client);
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd packages/test-app-v4 && npx vitest run
```

Expected: all 6 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /path/to/repo/root
git add packages/test-app-v4/src/index.test.ts
git commit -m "test(test-app-v4): add behavioral tests"
```

---

## Task 3: objectid-rename transform

Renames every `ObjectID` identifier (import specifier, type reference, value usage) to `ObjectId`. This single-pass rename handles all three cases because they're all `Identifier` AST nodes.

**Files:**
- Create: `packages/cli/src/catalog/v5/objectid-rename/transform.ts`

- [ ] **Step 1: Create the transform**

```typescript
import type { API, FileInfo } from 'jscodeshift';

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.Identifier, { name: 'ObjectID' }).forEach(path => {
    path.node.name = 'ObjectId';
    dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/catalog/v5/objectid-rename/transform.ts
git commit -m "feat(cli): add objectid-rename transform for v4→v5"
```

---

## Task 4: remove-v4-options transform

Removes `slaveOk`, `promiseLibrary`, and `keepGoing` from any object literal. Identical pattern to `remove-client-options` and `remove-connection-options`.

**Files:**
- Create: `packages/cli/src/catalog/v5/remove-v4-options/transform.ts`

- [ ] **Step 1: Create the transform**

```typescript
import type { API, FileInfo, ObjectProperty, Identifier, StringLiteral } from 'jscodeshift';

const REMOVED_OPTIONS = new Set(['slaveOk', 'promiseLibrary', 'keepGoing']);

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root.find(j.ObjectExpression).forEach(path => {
    const before = path.node.properties.length;
    path.node.properties = path.node.properties.filter(prop => {
      if (prop.type !== 'ObjectProperty') return true;
      const key = (prop as ObjectProperty).key;
      const name = key.type === 'Identifier' ? (key as Identifier).name
                 : key.type === 'StringLiteral' ? (key as StringLiteral).value
                 : null;
      return name === null || !REMOVED_OPTIONS.has(name);
    });
    if (path.node.properties.length < before) dirty = true;
  });

  return dirty ? root.toSource() : undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/catalog/v5/remove-v4-options/transform.ts
git commit -m "feat(cli): add remove-v4-options transform (slaveOk, promiseLibrary, keepGoing)"
```

---

## Task 5: v5 semantic transforms

Four flagging transforms: legacy collection methods (`insert`/`update`/`remove`), `mapReduce`, and the callback-based API.

**Files:**
- Create: `packages/cli/src/catalog/v5/semantic/transform.ts`

- [ ] **Step 1: Create the semantic transform file**

```typescript
import type { API, FileInfo, Identifier } from 'jscodeshift';

function addLeadingTodo(j: API['jscodeshift'], path: any, message: string): void {
  let stmtPath: any = path;
  while (stmtPath.parent && !j.Statement.check(stmtPath.parent.node)) {
    stmtPath = stmtPath.parent;
  }
  const stmtNode = stmtPath.parent ? stmtPath.parent.node : stmtPath.node;
  const comment: any = {
    type: 'CommentLine',
    value: ` TODO(mongodb-upgrade): ${message}`,
    leading: true,
    trailing: false,
  };
  stmtNode.comments = [...(stmtNode.comments ?? []), comment];
}

const LEGACY_METHODS = new Map([
  ['insert', 'insertOne() / insertMany()'],
  ['update', 'updateOne() / updateMany()'],
  ['remove', 'deleteOne() / deleteMany()'],
]);

export function transformLegacyMethods(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  for (const [method, replacement] of LEGACY_METHODS) {
    root
      .find(j.CallExpression, {
        callee: { type: 'MemberExpression', property: { type: 'Identifier', name: method } },
      })
      .forEach(path => {
        addLeadingTodo(j, path,
          `collection.${method}() has been removed in v5. Use ${replacement} instead.`);
        dirty = true;
      });
  }

  return dirty ? root.toSource() : undefined;
}

export function transformMapReduce(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'mapReduce' } },
    })
    .forEach(path => {
      addLeadingTodo(j, path,
        'collection.mapReduce() has been removed in v5. Rewrite using the aggregation pipeline ($group, $project, etc.) instead.');
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

const MONGO_CALLBACK_METHODS = new Set([
  'find', 'findOne', 'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete',
  'insertOne', 'insertMany', 'insert',
  'updateOne', 'updateMany', 'update',
  'deleteOne', 'deleteMany', 'remove',
  'replaceOne', 'aggregate', 'countDocuments', 'count', 'distinct',
  'bulkWrite', 'createIndex', 'dropCollection',
]);

export function transformCallbackApi(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression)
    .filter(path => {
      const callee = path.node.callee;
      if (callee.type !== 'MemberExpression') return false;
      const prop = callee.property;
      if (prop.type !== 'Identifier') return false;
      if (!MONGO_CALLBACK_METHODS.has((prop as Identifier).name)) return false;
      const args = path.node.arguments;
      if (args.length === 0) return false;
      const lastArg = args[args.length - 1];
      return lastArg.type === 'ArrowFunctionExpression' || lastArg.type === 'FunctionExpression';
    })
    .forEach(path => {
      const methodName = ((path.node.callee as any).property as Identifier).name;
      addLeadingTodo(j, path,
        `Callback-based .${methodName}() has been removed in v5. Convert to async/await: const result = await collection.${methodName}(...args).`);
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

export default function transform(file: FileInfo, api: API): string | undefined {
  let source = file.source;
  for (const fn of [transformLegacyMethods, transformMapReduce, transformCallbackApi]) {
    const result = fn({ ...file, source }, api);
    if (result !== undefined) source = result;
  }
  return source !== file.source ? source : undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/catalog/v5/semantic/transform.ts
git commit -m "feat(cli): add v5 semantic transforms (legacy methods, mapReduce, callback API)"
```

---

## Task 6: v5 env checks

**Files:**
- Create: `packages/cli/src/env/v5.ts`

- [ ] **Step 1: Create the env checks file**

```typescript
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as semver from 'semver';
import type { EnvCheck } from '../catalog/types.js';

function readPkg(cwd: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
}

function writePkg(cwd: string, pkg: Record<string, unknown>): void {
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

const nodeVersionCheck: EnvCheck = (cwd) => {
  const pkg = readPkg(cwd);
  const engines = (pkg['engines'] as Record<string, string> | undefined) ?? {};
  const current = engines['node'] ?? '';
  const required = '>=16.0.0';
  if (current && semver.satisfies('16.0.0', current)) {
    return { status: 'ok', message: 'Node version requirement is satisfied' };
  }
  engines['node'] = required;
  pkg['engines'] = engines;
  writePkg(cwd, pkg);
  return { status: 'warn', message: `Updated engines.node to ${required}`, autoFixed: true };
};

const mongodbDepBump: EnvCheck = (cwd) => {
  const pkg = readPkg(cwd);
  const deps = (pkg['dependencies'] as Record<string, string> | undefined) ?? {};
  const devDeps = (pkg['devDependencies'] as Record<string, string> | undefined) ?? {};
  const target = '^5.0.0';

  if (deps['mongodb']) {
    deps['mongodb'] = target;
    pkg['dependencies'] = deps;
    writePkg(cwd, pkg);
    return { status: 'warn', message: `Bumped mongodb to ${target} in dependencies`, autoFixed: true };
  }
  if (devDeps['mongodb']) {
    devDeps['mongodb'] = target;
    pkg['devDependencies'] = devDeps;
    writePkg(cwd, pkg);
    return { status: 'warn', message: `Bumped mongodb to ${target} in devDependencies`, autoFixed: true };
  }
  return { status: 'ok', message: 'mongodb dependency not found (nothing to bump)' };
};

export const v5EnvChecks = [
  { id: 'node-version-v4to5', description: 'Update engines.node to >=16.0.0', check: nodeVersionCheck },
  { id: 'mongodb-dep-bump-v5', description: 'Bump mongodb dependency to ^5.0.0', check: mongodbDepBump },
];
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/env/v5.ts
git commit -m "feat(cli): add v5 env checks (node version, dep bump)"
```

---

## Task 7: Wire v5 codemods into catalog

**Files:**
- Create: `packages/cli/src/catalog/v5/index.ts`
- Modify: `packages/cli/src/catalog/index.ts`

- [ ] **Step 1: Create v5/index.ts**

Create `packages/cli/src/catalog/v5/index.ts`:

```typescript
import type { Codemod } from '../types.js';
import objectidRename from './objectid-rename/transform.js';
import removeV4Options from './remove-v4-options/transform.js';
import {
  transformLegacyMethods,
  transformMapReduce,
  transformCallbackApi,
} from './semantic/transform.js';
import { v5EnvChecks } from '../../env/v5.js';

const hop = { from: '4.x', to: '5.x' };
const pkg = ['mongodb'];

export const v5Codemods: Codemod[] = [
  {
    id: 'objectid-rename',
    description: 'Rename ObjectID to ObjectId (deprecated alias removed in v5)',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: objectidRename,
  },
  {
    id: 'remove-v4-options',
    description: 'Remove deprecated MongoClient/BulkWrite options (slaveOk, promiseLibrary, keepGoing)',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: removeV4Options,
  },
  {
    id: 'legacy-collection-methods',
    description: 'Flag collection.insert() / update() / remove() removed in v5',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformLegacyMethods,
  },
  {
    id: 'mapreduece-removed',
    description: 'Flag collection.mapReduce() removed in v5',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformMapReduce,
  },
  {
    id: 'callback-api',
    description: 'Flag callback-based MongoDB API calls removed in v5',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformCallbackApi,
  },
  ...v5EnvChecks.map(e => ({
    ...e,
    kind: 'env' as const,
    hop,
    packages: pkg,
  })),
];
```

- [ ] **Step 2: Update catalog/index.ts to import v5Codemods**

The file currently starts with `import { v6Codemods }`. Add the v5 import and spread it into the catalog array. The full updated file:

```typescript
import type { Codemod } from './types.js';
import { v5Codemods } from './v5/index.js';
import { v6Codemods } from './v6/index.js';
import streamTransform from './v7/stream-transform/transform.js';
import poolRetryLabel from './v7/pool-retry-label/transform.js';
import removeBetaNamespace from './v7/remove-beta-namespace/transform.js';
import removeClientOptions from './v7/remove-client-options/transform.js';
import removeDeprecatedTypes from './v7/remove-deprecated-types/transform.js';
import removeGridfsDeprecated from './v7/remove-gridfs-deprecated/transform.js';
import findOneOptions from './v7/find-one-options/transform.js';
import findOptionsGeneric from './v7/find-options-generic/transform.js';
import removePropertyAccess from './v7/remove-property-access/transform.js';
import { transformAwsCredentials, transformMongoCR, transformClientMetadata, transformBatchSize } from './v7/semantic/transform.js';
import { v7EnvChecks } from '../env/v7.js';

const hop = { from: '6.x', to: '7.x' };
const pkg = ['mongodb'];

const v7Codemods: Codemod[] = [
  { id: 'stream-transform', description: 'Replace cursor.stream({ transform: fn }) with cursor.stream().map(fn)', kind: 'mechanical', hop, packages: pkg, transform: streamTransform },
  { id: 'pool-retry-label', description: 'Fix typo: PoolRequstedRetry → PoolRequestedRetry', kind: 'mechanical', hop, packages: pkg, transform: poolRetryLabel },
  { id: 'remove-beta-namespace', description: 'Rewrite mongodb/beta imports to mongodb', kind: 'mechanical', hop, packages: pkg, transform: removeBetaNamespace },
  { id: 'remove-client-options', description: 'Remove deprecated MongoClient options (useNewUrlParser, useUnifiedTopology, noResponse, retryWrites)', kind: 'mechanical', hop, packages: pkg, transform: removeClientOptions },
  { id: 'remove-deprecated-types', description: 'Remove deprecated type imports from mongodb', kind: 'mechanical', hop, packages: pkg, transform: removeDeprecatedTypes },
  { id: 'remove-gridfs-deprecated', description: 'Remove deprecated GridFS options (contentType, aliases)', kind: 'mechanical', hop, packages: pkg, transform: removeGridfsDeprecated },
  { id: 'find-one-options', description: 'Remove deprecated FindOneOptions properties (batchSize, limit, noCursorTimeout)', kind: 'mechanical', hop, packages: pkg, transform: findOneOptions },
  { id: 'find-options-generic', description: 'Remove type parameter from FindOptions<T>', kind: 'mechanical', hop, packages: pkg, transform: findOptionsGeneric },
  { id: 'remove-property-access', description: 'Replace removed property accesses with undefined + TODO comment', kind: 'mechanical', hop, packages: pkg, transform: removePropertyAccess },
  { id: 'aws-explicit-credentials', description: 'Flag MONGODB-AWS URIs with embedded credentials', kind: 'semantic', hop, packages: pkg, transform: transformAwsCredentials },
  { id: 'mongodb-cr-auth', description: 'Flag MONGODB-CR auth mechanism usage', kind: 'semantic', hop, packages: pkg, transform: transformMongoCR },
  { id: 'client-metadata-props', description: 'Flag removed client metadata property accesses', kind: 'semantic', hop, packages: pkg, transform: transformClientMetadata },
  { id: 'cursor-implicit-batch-size', description: 'Flag batchSize: 1000 that may have compensated for removed default', kind: 'semantic', hop, packages: pkg, transform: transformBatchSize },
  ...v7EnvChecks.map(e => ({
    ...e,
    kind: 'env' as const,
    hop,
    packages: pkg,
  })),
];

export const catalog: Codemod[] = [...v5Codemods, ...v6Codemods, ...v7Codemods];

export function getCatalog(packages = ['mongodb']): Codemod[] {
  return catalog.filter(c => c.packages.some(p => packages.includes(p)));
}

export function getById(id: string): Codemod | undefined {
  return catalog.find(c => c.id === id);
}
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/catalog/v5/ packages/cli/src/catalog/index.ts
git commit -m "feat(cli): wire v5 codemods into catalog"
```

---

## Task 8: CLI integration tests for v4→v5

**Files:**
- Modify: `packages/cli/src/integration.test.ts`

- [ ] **Step 1: Add TEST_APP_V4 constant near the top of the file**

Find the line:
```typescript
const TEST_APP_V5 = join(import.meta.dirname, '../../test-app-v5');
```

Add after it:
```typescript
const TEST_APP_V4 = join(import.meta.dirname, '../../test-app-v4');
```

- [ ] **Step 2: Append four describe blocks to the end of the file**

```typescript
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

  it('remove-v4-options: removes slaveOk from connectWithSlaveOk', () => {
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
```

- [ ] **Step 3: Run the full CLI test suite**

```bash
cd packages/cli && npx vitest run
```

Expected: all tests pass. If `objectid-rename` assertion fails, check that the `ObjectID` string doesn't appear in any comment text in `test-app-v4/src/index.ts` (the fixture comments use lowercase `objectid-rename`, not `ObjectID`).

- [ ] **Step 4: Run all workspace tests**

```bash
cd /path/to/repo/root && npm test
```

Expected: all suites pass (CLI + test-app-v4 + test-app-v5 + test-app-v6).

- [ ] **Step 5: Push and verify CI**

```bash
git add packages/cli/src/integration.test.ts
git commit -m "test(cli): add integration tests for v4→v5 hop"
git push
gh run watch $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: CI green.

---

## Self-Review

**Spec coverage:**
- ✅ Callback-based API — `transformCallbackApi` (semantic)
- ✅ `Collection.insert / update / remove` — `transformLegacyMethods` (semantic)
- ✅ `Collection.mapReduce()` — `transformMapReduce` (semantic)
- ✅ `ObjectID` renamed to `ObjectId` — `objectid-rename` (mechanical)
- ✅ `slaveOk` option — `remove-v4-options` (mechanical)
- ✅ Custom Promise library support (`promiseLibrary`) — `remove-v4-options` (mechanical)
- ✅ `BulkWriteOptions.keepGoing` — `remove-v4-options` (mechanical)
- ✅ Env checks: node version >=16.0.0, dep bump to ^5.0.0
- ✅ Detection, plan (three hops), and transform output assertions

**Notes on `objectid-rename` assertion:**
The test uses `not.toContain('ObjectID')`. The fixture comments say `// --- Mechanical: objectid-rename ---` (lowercase), not `ObjectID`, so this assertion is safe. After the transform, every `ObjectID` identifier is renamed to `ObjectId`, leaving no uppercase `ObjectID` in the transformed source.

**Note on `transformCallbackApi` detection scope:**
The method list in `MONGO_CALLBACK_METHODS` covers the most common driver methods. It will occasionally flag non-MongoDB code that happens to use the same method names (e.g., a `find()` call with a callback on a custom object). This is acceptable for a flagging transform — false positives are safe because the user reviews them; false negatives miss real upgrade issues.
