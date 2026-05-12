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

describe('connectWithSsl', () => {
  it('returns a MongoClient (SSL options accepted, no connection opened)', () => {
    const c = connectWithSsl('mongodb://localhost:27017');
    expect(c).toBeInstanceOf(MongoClient);
  });
});

describe('connectWithKeepAlive', () => {
  it('returns a MongoClient (keepAlive options accepted, no connection opened)', () => {
    const c = connectWithKeepAlive('mongodb://localhost:27017');
    expect(c).toBeInstanceOf(MongoClient);
  });
});

describe('bulkWriteExample', () => {
  it('returns nInserted count as a number', async () => {
    const n = await bulkWriteExample(client);
    expect(typeof n).toBe('number');
  });
});

describe('findOneAndUpdateExample', () => {
  it('returns a result object (ModifyResult in v5, document in v6+)', async () => {
    const result = await findOneAndUpdateExample(client);
    // In v5 returns a ModifyResult wrapper; value is null when no doc matched
    expect(result === null || typeof result === 'object').toBe(true);
  });
});

describe('withTransactionExample', () => {
  it('completes the transaction without throwing', async () => {
    await withTransactionExample(client);
  });
});
