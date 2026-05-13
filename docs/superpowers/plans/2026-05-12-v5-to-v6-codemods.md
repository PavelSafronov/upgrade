# v5→v6 Codemods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full v5→v6 upgrade hop — transforms, env checks, test-app fixture, behavioral tests, and CLI integration tests — so the tool covers mongodb@5.x users.

**Architecture:** Follows the exact v6→v7 pattern already in the repo: each mechanical transform lives in `packages/cli/src/catalog/v6/<name>/transform.ts`, semantic transforms are combined in `packages/cli/src/catalog/v6/semantic/transform.ts`, and env checks live in `packages/cli/src/env/v6.ts`. The test fixture in `packages/test-app-v5` gets a populated `src/index.ts` with one example of every v5→v6 deprecated pattern, a behavioral test suite, and vitest+mongodb-memory-server in devDependencies. CLI integration tests mirror the v6 describe blocks in `packages/cli/src/integration.test.ts`.

**Tech Stack:** jscodeshift (AST transforms), vitest (tests), mongodb-memory-server (in-process MongoDB for behavioral tests), Node.js 20.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/test-app-v5/src/index.ts` | Populate with v5→v6 deprecated patterns |
| Modify | `packages/test-app-v5/package.json` | Add `type:module`, vitest, mongodb-memory-server |
| Create | `packages/test-app-v5/src/index.test.ts` | Behavioral tests (real MongoDB) |
| Create | `packages/cli/src/catalog/v6/remove-connection-options/transform.ts` | Remove sslCA/sslCert/keepAlive/etc options |
| Create | `packages/cli/src/catalog/v6/bulk-result-props/transform.ts` | Replace removed BulkWriteResult props |
| Create | `packages/cli/src/catalog/v6/semantic/transform.ts` | Flag addUser, stats, findOneAnd, withTransaction |
| Modify | `packages/cli/src/catalog/v6/index.ts` | Replace stub with real codemod registrations |
| Create | `packages/cli/src/env/v6.ts` | Env checks (dep bump, node version) |
| Modify | `packages/cli/src/catalog/index.ts` | Import v6 env checks, wire into catalog |
| Modify | `packages/cli/src/integration.test.ts` | Add v5 test suites |

---

## Task 1: Populate test-app-v5 fixture

**Files:**
- Modify: `packages/test-app-v5/src/index.ts`
- Modify: `packages/test-app-v5/package.json`

- [ ] **Step 1: Replace the stub index.ts with real deprecated patterns**

Replace the entire contents of `packages/test-app-v5/src/index.ts`:

```typescript
import { MongoClient } from 'mongodb';

// --- Mechanical: remove-connection-options (SSL) ---
export function connectWithSsl(uri: string) {
  return new MongoClient(uri, {
    sslCA: '/path/to/ca.pem',
    sslCert: '/path/to/cert.pem',
    sslKey: '/path/to/key.pem',
    sslPass: 'secret',
    sslValidate: true,
    maxPoolSize: 10,
  });
}

// --- Mechanical: remove-connection-options (keepAlive) ---
export function connectWithKeepAlive(uri: string) {
  return new MongoClient(uri, {
    keepAlive: true,
    keepAliveInitialDelay: 30000,
    maxPoolSize: 5,
  });
}

// --- Mechanical: bulk-result-props ---
export async function bulkWriteExample(client: MongoClient) {
  const result = await client
    .db('test')
    .collection('items')
    .bulkWrite([{ insertOne: { document: { x: 1 } } }]);
  return result.nInserted;
}

// --- Semantic: db-adduser-removed ---
export async function addUserExample(client: MongoClient) {
  await (client.db('admin') as any).addUser('newuser', 'password', {
    roles: [{ role: 'readWrite', db: 'test' }],
  });
}

// --- Semantic: collection-stats-removed ---
export async function statsExample(client: MongoClient) {
  return (client.db('test').collection('items') as any).stats();
}

// --- Semantic: findoneand-metadata ---
export async function findOneAndUpdateExample(client: MongoClient) {
  return client
    .db('test')
    .collection('items')
    .findOneAndUpdate({ x: 1 }, { $set: { x: 2 } });
}

// --- Semantic: withtransaction-return ---
export async function withTransactionExample(client: MongoClient) {
  const session = client.startSession();
  const result = await session.withTransaction(async () => {
    await client.db('test').collection('items').insertOne({ y: 1 });
    return 'done';
  });
  await session.endSession();
  return result;
}
```

- [ ] **Step 2: Update package.json to add vitest and mongodb-memory-server**

Replace `packages/test-app-v5/package.json`:

```json
{
  "name": "test-app-v5",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Kitchen-sink app using every mongodb v5 deprecated API — used as CLI upgrade demo target",
  "engines": { "node": ">=14.0.0" },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "mongodb": "5.8.1"
  },
  "devDependencies": {
    "mongodb-memory-server": "^9.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Install new deps**

```bash
npm install
```

Expected: package-lock.json updated, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/test-app-v5/src/index.ts packages/test-app-v5/package.json package-lock.json
git commit -m "chore(test-app-v5): populate deprecated v5 patterns and add vitest"
```

---

## Task 2: Behavioral tests for test-app-v5

**Files:**
- Create: `packages/test-app-v5/src/index.test.ts`

- [ ] **Step 1: Create the test file**

Create `packages/test-app-v5/src/index.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import {
  connectWithSsl,
  connectWithKeepAlive,
  bulkWriteExample,
  findOneAndUpdateExample,
  withTransactionExample,
} from './index.js';

let mongod: MongoMemoryServer;
let client: MongoClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  client = new MongoClient(mongod.getUri());
  await client.connect();
}, 120_000);

afterAll(async () => {
  await client.close();
  await mongod.stop();
});

describe('connectWithSsl', () => {
  it('returns a MongoClient (options accepted, no connection opened)', () => {
    const c = connectWithSsl('mongodb://localhost:27017');
    expect(c).toBeInstanceOf(MongoClient);
  });
});

describe('connectWithKeepAlive', () => {
  it('returns a MongoClient (options accepted, no connection opened)', () => {
    const c = connectWithKeepAlive('mongodb://localhost:27017');
    expect(c).toBeInstanceOf(MongoClient);
  });
});

describe('bulkWriteExample', () => {
  it('returns nInserted count', async () => {
    const n = await bulkWriteExample(client);
    expect(typeof n).toBe('number');
  });
});

describe('findOneAndUpdateExample', () => {
  it('returns a document or null', async () => {
    const doc = await findOneAndUpdateExample(client);
    // In v5 returns ModifyResult; value is null when no doc matched
    expect(doc === null || typeof doc === 'object').toBe(true);
  });
});

describe('withTransactionExample', () => {
  it('completes without throwing', async () => {
    await expect(withTransactionExample(client)).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd packages/test-app-v5 && npx vitest run
```

Expected: all 5 tests pass (first run downloads MongoDB binary ~60 MB; subsequent runs are fast).

- [ ] **Step 3: Commit**

```bash
git add packages/test-app-v5/src/index.test.ts
git commit -m "test(test-app-v5): add behavioral tests"
```

---

## Task 3: remove-connection-options transform

Removes `sslCA`, `sslCRL`, `sslCert`, `sslKey`, `sslPass`, `sslValidate`, `tlsCertificateFile`, `keepAlive`, `keepAliveInitialDelay` from any object literal. These were removed in v6; the TLS equivalents (`tls`, `tlsCAFile`, etc.) are the replacements.

**Files:**
- Create: `packages/cli/src/catalog/v6/remove-connection-options/transform.ts`

- [ ] **Step 1: Create the transform**

```typescript
import type { API, FileInfo, ObjectProperty, Identifier, StringLiteral } from 'jscodeshift';

const REMOVED_OPTIONS = new Set([
  'sslCA', 'sslCRL', 'sslCert', 'sslKey', 'sslPass', 'sslValidate', 'tlsCertificateFile',
  'keepAlive', 'keepAliveInitialDelay',
]);

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
git add packages/cli/src/catalog/v6/remove-connection-options/transform.ts
git commit -m "feat(cli): add remove-connection-options transform for v5→v6"
```

---

## Task 4: bulk-result-props transform

Replaces `.nInserted`, `.nUpserted`, `.nMatched`, `.nModified`, `.nRemoved` member expressions with `undefined` and adds a TODO comment. These properties were removed from `BulkWriteResult` in v6.

**Files:**
- Create: `packages/cli/src/catalog/v6/bulk-result-props/transform.ts`

- [ ] **Step 1: Create the transform**

```typescript
import type { API, FileInfo, Identifier } from 'jscodeshift';

const REMOVED_PROPS: Array<{ name: string; replacement: string }> = [
  { name: 'nInserted',  replacement: 'insertedCount' },
  { name: 'nUpserted',  replacement: 'upsertedCount' },
  { name: 'nMatched',   replacement: 'matchedCount'  },
  { name: 'nModified',  replacement: 'modifiedCount' },
  { name: 'nRemoved',   replacement: 'deletedCount'  },
];

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  for (const { name, replacement } of REMOVED_PROPS) {
    root
      .find(j.MemberExpression, {
        property: { type: 'Identifier', name },
      })
      .forEach(path => {
        let stmtPath: any = path;
        while (stmtPath.parent && !j.Statement.check(stmtPath.parent.node)) {
          stmtPath = stmtPath.parent;
        }
        const stmtNode = stmtPath.parent ? stmtPath.parent.node : stmtPath.node;
        const comment: any = {
          type: 'CommentLine',
          value: ` TODO(mongodb-upgrade): BulkWriteResult.${name} removed in v6. Use .${replacement} instead.`,
          leading: true,
          trailing: false,
        };
        stmtNode.comments = [...(stmtNode.comments ?? []), comment];
        j(path).replaceWith(j.identifier('undefined'));
        dirty = true;
      });
  }

  return dirty ? root.toSource() : undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/catalog/v6/bulk-result-props/transform.ts
git commit -m "feat(cli): add bulk-result-props transform for v5→v6"
```

---

## Task 5: v6 semantic transforms

Flags four patterns that cannot be auto-fixed: `addUser()`, `stats()`, `findOneAndUpdate/Replace/Delete` without `includeResultMetadata`, and `withTransaction` return-value usage.

**Files:**
- Create: `packages/cli/src/catalog/v6/semantic/transform.ts`

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

export function transformAddUser(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'addUser' } },
    })
    .forEach(path => {
      addLeadingTodo(j, path,
        'db.addUser() has been removed in v6. Manage users via the MongoDB shell or a dedicated admin script.');
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

export function transformCollectionStats(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'stats' } },
    })
    .forEach(path => {
      addLeadingTodo(j, path,
        'collection.stats() has been removed in v6. Use db.command({ collStats: collectionName }) instead.');
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

export function transformFindOneAnd(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  const METHODS = new Set(['findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete']);

  root
    .find(j.CallExpression)
    .filter(path => {
      const callee = path.node.callee;
      return (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier' &&
        METHODS.has((callee.property as Identifier).name)
      );
    })
    .filter(path => {
      // Only flag if no options argument with includeResultMetadata present
      return !path.node.arguments.some(arg => {
        if (arg.type !== 'ObjectExpression') return false;
        return (arg as any).properties.some(
          (p: any) =>
            p.type === 'ObjectProperty' &&
            p.key.type === 'Identifier' &&
            p.key.name === 'includeResultMetadata',
        );
      });
    })
    .forEach(path => {
      const methodName = ((path.node.callee as any).property as Identifier).name;
      addLeadingTodo(j, path,
        `${methodName}() now returns the document directly (not wrapped in ModifyResult) unless you pass { includeResultMetadata: true }. Verify your code handles the new return type.`);
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

export function transformWithTransaction(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let dirty = false;

  root
    .find(j.CallExpression, {
      callee: { type: 'MemberExpression', property: { type: 'Identifier', name: 'withTransaction' } },
    })
    .filter(path => {
      // Flag only when the return value is used (not a bare expression statement)
      const parent = path.parent?.node;
      return !j.ExpressionStatement.check(parent);
    })
    .forEach(path => {
      addLeadingTodo(j, path,
        'withTransaction() always returns void in v6. The return value of your callback is discarded.');
      dirty = true;
    });

  return dirty ? root.toSource() : undefined;
}

export default function transform(file: FileInfo, api: API): string | undefined {
  let source = file.source;
  for (const fn of [transformAddUser, transformCollectionStats, transformFindOneAnd, transformWithTransaction]) {
    const result = fn({ ...file, source }, api);
    if (result !== undefined) source = result;
  }
  return source !== file.source ? source : undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/catalog/v6/semantic/transform.ts
git commit -m "feat(cli): add v6 semantic transforms (addUser, stats, findOneAnd, withTransaction)"
```

---

## Task 6: v6 env checks

**Files:**
- Create: `packages/cli/src/env/v6.ts`

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
  const required = '>=16.20.1';
  if (current && semver.satisfies('16.20.1', current)) {
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
  const target = '^6.0.0';

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

export const v6EnvChecks = [
  { id: 'node-version-v5to6', description: 'Update engines.node to >=16.20.1', check: nodeVersionCheck },
  { id: 'mongodb-dep-bump-v6', description: 'Bump mongodb dependency to ^6.0.0', check: mongodbDepBump },
];
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/env/v6.ts
git commit -m "feat(cli): add v6 env checks (node version, dep bump)"
```

---

## Task 7: Wire v6 codemods into the catalog

**Files:**
- Modify: `packages/cli/src/catalog/v6/index.ts`
- Modify: `packages/cli/src/catalog/index.ts`

- [ ] **Step 1: Replace the v6/index.ts stub**

Replace the entire contents of `packages/cli/src/catalog/v6/index.ts`:

```typescript
import type { Codemod } from '../types.js';
import removeConnectionOptions from './remove-connection-options/transform.js';
import bulkResultProps from './bulk-result-props/transform.js';
import semanticTransform from './semantic/transform.js';
import { v6EnvChecks } from '../../env/v6.js';

const hop = { from: '5.x', to: '6.x' };
const pkg = ['mongodb'];

export const v6Codemods: Codemod[] = [
  {
    id: 'remove-connection-options-v6',
    description: 'Remove deprecated SSL and keepAlive connection options',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: removeConnectionOptions,
  },
  {
    id: 'bulk-result-props',
    description: 'Replace removed BulkWriteResult properties (nInserted etc.) with undefined + TODO',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: bulkResultProps,
  },
  {
    id: 'db-adduser-removed',
    description: 'Flag db.addUser() / admin.addUser() removed in v6',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: semanticTransform,
  },
  ...v6EnvChecks.map(e => ({
    ...e,
    kind: 'env' as const,
    hop,
    packages: pkg,
  })),
];
```

Note: Only one entry is needed for the combined semantic transform — the runner calls `codemod.transform` once per file, and the combined default export chains all four semantic checks internally.

Wait — looking at the v7 catalog, each semantic codemod has its own entry because the report tracks them individually. We need to import the named exports and give each its own entry. Update Step 1:

```typescript
import type { Codemod } from '../types.js';
import removeConnectionOptions from './remove-connection-options/transform.js';
import bulkResultProps from './bulk-result-props/transform.js';
import {
  transformAddUser,
  transformCollectionStats,
  transformFindOneAnd,
  transformWithTransaction,
} from './semantic/transform.js';
import { v6EnvChecks } from '../../env/v6.js';

const hop = { from: '5.x', to: '6.x' };
const pkg = ['mongodb'];

export const v6Codemods: Codemod[] = [
  {
    id: 'remove-connection-options-v6',
    description: 'Remove deprecated SSL and keepAlive connection options',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: removeConnectionOptions,
  },
  {
    id: 'bulk-result-props',
    description: 'Replace removed BulkWriteResult properties (nInserted etc.) with undefined + TODO',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: bulkResultProps,
  },
  {
    id: 'db-adduser-removed',
    description: 'Flag db.addUser() / admin.addUser() removed in v6',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformAddUser,
  },
  {
    id: 'collection-stats-removed',
    description: 'Flag collection.stats() removed in v6',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformCollectionStats,
  },
  {
    id: 'findoneand-metadata',
    description: 'Flag findOneAndUpdate/Replace/Delete calls missing includeResultMetadata',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformFindOneAnd,
  },
  {
    id: 'withtransaction-return',
    description: 'Flag withTransaction return value usage (always void in v6)',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformWithTransaction,
  },
  ...v6EnvChecks.map(e => ({
    ...e,
    kind: 'env' as const,
    hop,
    packages: pkg,
  })),
];
```

- [ ] **Step 2: Update catalog/index.ts to import v6 env checks**

Open `packages/cli/src/catalog/index.ts`. The file already imports `v6Codemods` from `./v6/index.js`. Find the section that maps `v7EnvChecks` and add a matching spread for `v6EnvChecks`. The full updated file:

```typescript
import type { Codemod } from './types.js';
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

export const catalog: Codemod[] = [...v6Codemods, ...v7Codemods];

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

Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/catalog/v6/index.ts packages/cli/src/catalog/index.ts
git commit -m "feat(cli): wire v6 codemods into catalog"
```

---

## Task 8: CLI integration tests for v5→v6

**Files:**
- Modify: `packages/cli/src/integration.test.ts`

- [ ] **Step 1: Add v5 detection/plan suite**

Append to the imports at the top of `packages/cli/src/integration.test.ts`:

```typescript
const TEST_APP_V5 = join(import.meta.dirname, '../../test-app-v5');
```

Then append the following describe blocks to the end of the file:

```typescript
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

  it('remove-connection-options-v6: removes sslCA, sslCert, sslKey, sslPass, sslValidate', () => {
    expect(transformed).not.toContain('sslCA');
    expect(transformed).not.toContain('sslCert');
    expect(transformed).not.toContain('sslKey');
    expect(transformed).not.toContain('sslPass');
    expect(transformed).not.toContain('sslValidate');
    expect(transformed).toContain('maxPoolSize');
  });

  it('remove-connection-options-v6: removes keepAlive and keepAliveInitialDelay', () => {
    expect(transformed).not.toContain('keepAlive');
    expect(transformed).not.toContain('keepAliveInitialDelay');
  });

  it('bulk-result-props: replaces nInserted with undefined + TODO', () => {
    expect(transformed).not.toMatch(/\.nInserted\b(?!\s*removed)/);
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
```

- [ ] **Step 2: Run the full CLI test suite**

```bash
cd packages/cli && npx vitest run
```

Expected: all tests pass. If any output-assertion tests fail, check the exact TODO message strings — they must exactly match what the transforms emit.

- [ ] **Step 3: Run all workspace tests**

```bash
cd /path/to/repo/root && npm test
```

Expected: all suites pass.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/integration.test.ts
git commit -m "test(cli): add integration tests for v5→v6 hop"
```

---

## Self-Review

**Spec coverage:**
- ✅ `sslCA`, `sslCRL`, `sslCert`, `sslKey`, `sslPass`, `sslValidate`, `tlsCertificateFile` — `remove-connection-options` transform
- ✅ `keepAlive`, `keepAliveInitialDelay` — same transform
- ✅ `BulkWriteResult.nInserted/nUpserted/nMatched/nModified/nRemoved` — `bulk-result-props` transform
- ✅ `db.addUser()` — semantic `transformAddUser`
- ✅ `collection.stats()` — semantic `transformCollectionStats`
- ✅ `findOneAndUpdate/Replace/Delete` without `includeResultMetadata` — semantic `transformFindOneAnd`
- ✅ `withTransaction` return value — semantic `transformWithTransaction`
- ✅ Env checks: Node version, mongodb dep bump
- ✅ Detection and plan tests for 5→6→7 path
- ✅ Behavioral tests in test-app-v5

**Notes:**
- `sslCRL` and `tlsCertificateFile` are in the transform's `REMOVED_OPTIONS` set but not in the test-app-v5 fixture — intentional (the fixture shows representative examples, not every option).
- `addUserExample` and `statsExample` are exported but not tested with a real MongoDB in the behavioral suite because `addUser` requires admin credentials and `stats` is removed in v6 (the test would need to use mongodb@5 where it still exists, which the fixture does). If behavioral tests for these are desired, add them in a follow-up.

---

**Follow-up:** After this plan is complete, implement the v4→v5 hop in a separate plan: `ObjectID→ObjectId` rename, `collection.insert/update/remove` removal, `mapReduce` flag, `slaveOk`/`promiseLibrary`/`keepGoing` option removal, and callback-API semantic flagging.
