import {
  MongoClient,
  ReadPreference,
  CloseOptions,
  CancellationToken,
  Transaction,
  ResumeOptions,
  ServerCapabilities,
  FindOptions,
  ClientMetadataOptions,
} from 'mongodb';
import type { GridFSBucketWriteStreamOptions } from 'mongodb';

// --- Mechanical: stream-transform ---
async function streamExample(client: MongoClient) {
  const cursor = client.db('test').collection('docs').find({});
  const stream = cursor.stream({ transform: JSON.stringify as any });
  return stream;
}

// --- Mechanical: pool-retry-label ---
export async function fireRequest(client: MongoClient): Promise<string | null> {
  try {
    await client.db('test').collection('items').findOne({});
    return null;
  } catch (error: any) {
    if (error.hasErrorLabel?.('PoolRequstedRetry')) {
      return error.message;
    }
    throw error;
  }
}

// --- Mechanical: remove-client-options ---
function connectClient(uri: string) {
  return new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
  } as any);
}

// --- Mechanical: remove-deprecated-types ---
const closeOpts: CloseOptions = {};
const token: CancellationToken = {} as CancellationToken;
const resumeOpts: ResumeOptions = {};
const svrCaps: ServerCapabilities = {} as ServerCapabilities;
const metaOpts: ClientMetadataOptions = {} as ClientMetadataOptions;

// --- Mechanical: remove-gridfs-deprecated ---
const writeStreamOpts: GridFSBucketWriteStreamOptions = {
  contentType: 'text/plain',
  aliases: ['readme', 'docs'],
  chunkSizeBytes: 261120,
};

// --- Mechanical: find-options-generic ---
const findOpts: FindOptions<{ name: string }> = { limit: 10 };

// --- Mechanical: remove-property-access ---
// @ts-ignore -- instance property accessed as static; removed in v7
const minWire = ReadPreference.minWireVersion;

async function sessionExample(client: MongoClient) {
  const session = client.startSession();
  const txn = session.transaction;
  await session.endSession();
}

// --- Semantic: aws-explicit-credentials ---
const awsClient = new MongoClient(
  'mongodb://AKID:SECRET@cluster.example.com/?authMechanism=MONGODB-AWS'
);

// --- Semantic: mongodb-cr-auth ---
const crClient = new MongoClient('mongodb://localhost:27017', {
  authMechanism: 'MONGODB-CR' as any,
});

// --- Semantic: client-metadata-props ---
async function metaExample(client: MongoClient) {
  console.log((client.options as any).additionalDriverInfo);
}

// --- Semantic: cursor-implicit-batch-size ---
async function batchExample(client: MongoClient) {
  const cursor = client.db('test').collection('docs').find({}, { batchSize: 1000 });
  return cursor.toArray();
}

export { streamExample, connectClient, sessionExample, metaExample, batchExample, awsClient, crClient };
