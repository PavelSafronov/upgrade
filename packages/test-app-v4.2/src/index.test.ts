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
    // @ts-ignore -- v4.2 overloads resolve bulkWrite to void when options is `any`; runtime returns BulkWriteResult
    expect(typeof result.insertedCount).toBe('number');
  });
});

describe('insertExample', () => {
  it('inserts a document (deprecated .insert() in v4)', async () => {
    const result = await insertExample(client);
    expect(result).toBeDefined();
  });
});
