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
