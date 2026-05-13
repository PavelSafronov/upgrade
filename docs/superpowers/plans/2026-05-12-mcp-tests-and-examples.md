# MCP Server Tests and explain_breaking_change Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit tests for the three MCP tool functions (analyzeRepo, applyCodemod, explainBreakingChange), and fill in the EXAMPLES map in explainBreakingChange with before/after code snippets for all v5 and v6 codemods.

**Architecture:** Tests live in `packages/mcp/src/tools.test.ts` and exercise the tool handler functions directly (not the MCP server wire layer). The `EXAMPLES` map in `explain-breaking-change.ts` is extended with entries for every v5 (4.x→5.x) and v6 (5.x→6.x) codemod, matching the structure already in place for v7 codemods. No live MongoDB needed — analyzeRepo/applyCodemod are called in dry-run mode.

**Tech Stack:** Vitest, TypeScript, existing `@mongodb-js/upgrade` workspace package, `node:fs`/`node:os`/`node:path` for tmp fixtures (same pattern as CLI integration tests).

---

### Task 1: MCP tool unit tests

**Files:**
- Create: `packages/mcp/src/tools.test.ts`

- [ ] **Step 1: Create the test file**

Create `packages/mcp/src/tools.test.ts`:

```typescript
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
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd packages/mcp && npx vitest run
```

Expected output: `Tests 8 passed (8)`

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/tools.test.ts
git commit -m "test(mcp): add unit tests for analyzeRepo, applyCodemod, explainBreakingChange"
```

---

### Task 2: v5/v6 examples in explainBreakingChange

**Files:**
- Modify: `packages/mcp/src/tools.test.ts` (add 2 new tests inside the existing explainBreakingChange describe block)
- Modify: `packages/mcp/src/tools/explain-breaking-change.ts` (add EXAMPLES entries)

- [ ] **Step 1: Add two failing tests**

Append these two `it()` calls inside the `describe('explainBreakingChange', ...)` block in `packages/mcp/src/tools.test.ts`, after the 'throws for an unknown id' test:

```typescript
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
```

- [ ] **Step 2: Run to verify the 2 new tests fail**

```bash
cd packages/mcp && npx vitest run
```

Expected: 8 pass, 2 fail with `AssertionError: expected '(no example available)' to contain 'ObjectID'` and similar.

- [ ] **Step 3: Add EXAMPLES entries for v5 codemods**

In `packages/mcp/src/tools/explain-breaking-change.ts`, add these entries to the `EXAMPLES` object after the last existing v7 entry (`'cursor-implicit-batch-size'`):

```typescript
  'objectid-rename': {
    before: `import { ObjectID } from 'mongodb';\nconst id = new ObjectID('507f1f77bcf86cd799439011');`,
    after:  `import { ObjectId } from 'mongodb';\nconst id = new ObjectId('507f1f77bcf86cd799439011');`,
    notes:  'ObjectID was a deprecated alias for ObjectId in v4 and has been fully removed in v5. Rename all usages.',
  },
  'remove-v4-options': {
    before: `new MongoClient(uri, { slaveOk: true, promiseLibrary: Promise, keepGoing: true })`,
    after:  `new MongoClient(uri, {})`,
    notes:  'slaveOk, promiseLibrary, and keepGoing were removed in v5. Remove them from any options objects.',
  },
  'legacy-collection-methods': {
    before: `await collection.insert({ x: 1 });\nawait collection.update({ x: 1 }, { $set: { x: 2 } });\nawait collection.remove({ x: 1 });`,
    after:  `await collection.insertOne({ x: 1 });\nawait collection.updateOne({ x: 1 }, { $set: { x: 2 } });\nawait collection.deleteOne({ x: 1 });`,
    notes:  'The legacy methods insert/update/remove were removed in v5. Use insertOne/insertMany, updateOne/updateMany, deleteOne/deleteMany.',
  },
  'mapreduece-removed': {
    before: `await collection.mapReduce(mapFn, reduceFn, { out: { inline: 1 } });`,
    after:  `await collection.aggregate([{ $group: { _id: '$key', count: { $sum: 1 } } }]).toArray();`,
    notes:  'collection.mapReduce() was removed in v5. Rewrite using the aggregation pipeline ($group, $project, etc.).',
  },
  'callback-api': {
    before: `collection.findOne({ x: 1 }, (err, doc) => { console.log(doc); });`,
    after:  `const doc = await collection.findOne({ x: 1 });\nconsole.log(doc);`,
    notes:  'Callback-based MongoDB API was removed in v5. All methods now return Promises — convert to async/await.',
  },
```

- [ ] **Step 4: Add EXAMPLES entries for v6 codemods**

Still in `packages/mcp/src/tools/explain-breaking-change.ts`, add after the v5 entries:

```typescript
  'remove-connection-options-v6': {
    before: `new MongoClient(uri, { sslValidate: false, sslPass: 'secret', keepAlive: true, keepAliveInitialDelay: 30000 })`,
    after:  `new MongoClient(uri, { tlsAllowInvalidCertificates: true, tlsCertificateKeyFilePassword: 'secret' })`,
    notes:  'ssl* and keepAlive* connection options were removed in v6. Use the equivalent tls* options. keepAlive is now always enabled.',
  },
  'bulk-result-props': {
    before: `console.log(result.nInserted, result.nUpserted, result.nModified, result.nRemoved);`,
    after:  `console.log(result.insertedCount, result.upsertedCount, result.modifiedCount, result.deletedCount);`,
    notes:  'BulkWriteResult properties nInserted/nUpserted/nMatched/nModified/nRemoved were removed in v6. Use insertedCount, upsertedCount, matchedCount, modifiedCount, deletedCount.',
  },
  'db-adduser-removed': {
    before: `await db.addUser('alice', 'password', { roles: [{ role: 'readWrite', db: 'test' }] });`,
    after:  `await db.command({ createUser: 'alice', pwd: 'password', roles: [{ role: 'readWrite', db: 'test' }] });`,
    notes:  "db.addUser() was removed in v6. Use db.command({ createUser: ... }) or provision users via MongoDB Atlas or mongosh.",
  },
  'collection-stats-removed': {
    before: `const stats = await collection.stats();`,
    after:  `const [stats] = await collection.aggregate([{ $collStats: { storageStats: {} } }]).toArray();`,
    notes:  'collection.stats() was removed in v6. Use the $collStats aggregation stage instead.',
  },
  'findoneand-metadata': {
    before: `const result = await collection.findOneAndUpdate(filter, update);\nconst doc = result.value;`,
    after:  `const doc = await collection.findOneAndUpdate(filter, update);\n// or pass { includeResultMetadata: true } for the legacy { value, ok, lastErrorObject } shape`,
    notes:  'findOneAndUpdate/Replace/Delete now return the document directly in v6. Pass includeResultMetadata: true to get the old result shape.',
  },
  'withtransaction-return': {
    before: `const result = await session.withTransaction(async () => {\n  return someValue;\n});`,
    after:  `let result;\nawait session.withTransaction(async () => {\n  result = someValue;\n});`,
    notes:  'withTransaction() always returns void in v6. Store results in an outer-scope variable instead of relying on the return value.',
  },
```

- [ ] **Step 5: Run MCP tests**

```bash
cd packages/mcp && npx vitest run
```

Expected: `Tests 10 passed (10)`

- [ ] **Step 6: Run all workspace tests**

```bash
cd /Users/pavel.safronov/code/upgrade && npm test
```

Expected: all suites pass.

- [ ] **Step 7: Commit and push**

```bash
git add packages/mcp/src/tools.test.ts packages/mcp/src/tools/explain-breaking-change.ts
git commit -m "feat(mcp): add v5/v6 explain examples; all MCP tool tests pass"
git push
gh run watch $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: CI green.

---

## Self-Review

**Spec coverage:**

1. MCP tool tests:
   - ✅ `analyzeRepo`: detects version, returns plan/codemods/fileBreakdown, includes v5 codemods for v4 app, throws on missing mongodb
   - ✅ `applyCodemod`: "all" dry-run, named codemod dry-run, unknown id throws
   - ✅ `explainBreakingChange`: known v7 codemod returns full shape, unknown id throws

2. v5/v6 examples — all 11 codemods covered:
   - ✅ `objectid-rename` (v5)
   - ✅ `remove-v4-options` (v5)
   - ✅ `legacy-collection-methods` (v5)
   - ✅ `mapreduece-removed` (v5)
   - ✅ `callback-api` (v5)
   - ✅ `remove-connection-options-v6` (v6)
   - ✅ `bulk-result-props` (v6)
   - ✅ `db-adduser-removed` (v6)
   - ✅ `collection-stats-removed` (v6)
   - ✅ `findoneand-metadata` (v6)
   - ✅ `withtransaction-return` (v6)

3. Representative failing tests before implementation:
   - ✅ `objectid-rename` (v5 representative)
   - ✅ `bulk-result-props` (v6 representative)

**Placeholder scan:** None found.

**Type consistency:**
- All codemod IDs match exactly what was registered in `packages/cli/src/catalog/v5/index.ts` and `packages/cli/src/catalog/v6/index.ts` (including the `mapreduece-removed` typo, kept intentionally for compatibility).
- `import.meta.dirname` used consistently with CLI integration tests.
- EXAMPLES object keys are string literals — no type mismatch possible.
