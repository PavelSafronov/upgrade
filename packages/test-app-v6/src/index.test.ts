import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import {
  streamExample,
  fireRequest,
  connectClient,
  sessionExample,
  batchExample,
  metaExample,
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

describe('streamExample', () => {
  it('returns a readable stream', async () => {
    const stream = await streamExample(client);
    expect(typeof stream.pipe).toBe('function');
    expect(typeof stream.on).toBe('function');
    // Drain the stream (collection is empty, so 'end' fires immediately).
    // This closes the cursor cleanly before afterAll closes the client.
    await new Promise<void>((resolve, reject) => {
      stream.resume();
      stream.once('end', resolve);
      stream.once('error', reject);
    });
  });
});

describe('fireRequest', () => {
  it('returns null on success', async () => {
    expect(await fireRequest(client)).toBeNull();
  });

  it('returns the error message when a PoolRequestedRetry error occurs', async () => {
    // pool-retry-label codemod fixes 'PoolRequstedRetry' here and inside
    // fireRequest — both change together, so this test passes before and after.
    const poolRetryError = Object.assign(new Error('connection pool cleared'), {
      hasErrorLabel: (l: string) => l === 'PoolRequstedRetry',
    });
    const mockClient = {
      db: () => ({ collection: () => ({ findOne: vi.fn().mockRejectedValueOnce(poolRetryError) }) }),
    } as unknown as MongoClient;

    expect(await fireRequest(mockClient)).toBe('connection pool cleared');
  });

  it('rethrows errors that are not pool retry errors', async () => {
    const mockClient = {
      db: () => ({ collection: () => ({ findOne: vi.fn().mockRejectedValueOnce(new Error('network timeout')) }) }),
    } as unknown as MongoClient;

    await expect(fireRequest(mockClient)).rejects.toThrow('network timeout');
  });
});

describe('connectClient', () => {
  it('returns a MongoClient', () => {
    const c = connectClient('mongodb://localhost:27017');
    expect(c).toBeInstanceOf(MongoClient);
    // Never called connect(), so no need to close — no connections were opened.
  });
});

describe('sessionExample', () => {
  it('starts and ends a session without throwing', async () => {
    await expect(sessionExample(client)).resolves.toBeUndefined();
  });
});

describe('batchExample', () => {
  it('returns an array (empty when collection has no docs)', async () => {
    const result = await batchExample(client);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('metaExample', () => {
  it('logs client options without throwing', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await metaExample(client);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
