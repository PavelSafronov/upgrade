import { MongoClient, ObjectID } from 'mongodb';

// --- Mechanical: objectid-rename ---
export const legacyId = new ObjectID('507f1f77bcf86cd799439011');

// @ts-ignore -- ObjectID exported as const in v4, not as a class; renamed to ObjectId in v5
export function findById(client: MongoClient, id: ObjectID) {
  return client.db('test').collection('items').findOne({ _id: id as any });
}

// --- Mechanical: remove-v4-options (slaveOk) ---
// slaveOk throws MongoParseError at construction time in v4; shown as a standalone object
export const SLAVE_OK_OPTIONS = {
  slaveOk: true,
};

export function connectWithSlaveOk(uri: string) {
  return new MongoClient(uri, { maxPoolSize: 5 });
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
