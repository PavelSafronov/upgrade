import { getById } from '@mongodb-js/upgrade/catalog/index';

export interface ExplainResult {
  id: string;
  description: string;
  kind: string;
  hop: { from: string; to: string };
  before: string;
  after: string;
  notes: string;
  docsUrl: string;
}

const DOCS_BASE = 'https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/';

const EXAMPLES: Record<string, { before: string; after: string; notes: string }> = {
  'stream-transform': {
    before: `const stream = cursor.stream({ transform: JSON.stringify });`,
    after:  `const stream = cursor.stream().map(JSON.stringify);`,
    notes:  'The transform option has been removed. Use the standard ReadableStream.map() method instead.',
  },
  'pool-retry-label': {
    before: `if (error.hasErrorLabel('PoolRequstedRetry')) { ... }`,
    after:  `if (error.hasErrorLabel('PoolRequestedRetry')) { ... }`,
    notes:  'Typo fix in the error label name. String comparisons against the old spelling will silently stop matching.',
  },
  'remove-client-options': {
    before: `new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })`,
    after:  `new MongoClient(uri, {})`,
    notes:  'These options were deprecated in v4 and no-ops since v4. They now throw if provided.',
  },
  'remove-deprecated-types': {
    before: `import { CloseOptions, CancellationToken } from 'mongodb';`,
    after:  `// (remove the import — these types no longer exist)`,
    notes:  'These types were deprecated in earlier versions and have been removed. TypeScript will report errors if they remain.',
  },
  'remove-gridfs-deprecated': {
    before: `bucket.openUploadStream('file.txt', { contentType: 'text/plain', aliases: ['doc'] })`,
    after:  `bucket.openUploadStream('file.txt', {})`,
    notes:  'GridFS contentType and aliases fields were deprecated and are no longer supported.',
  },
  'find-options-generic': {
    before: `const opts: FindOptions<{ name: string }> = {};`,
    after:  `const opts: FindOptions = {};`,
    notes:  'FindOptions no longer accepts a type parameter.',
  },
  'remove-property-access': {
    before: `ReadPreference.minWireVersion\nsession.transaction`,
    after:  `// remove these — they no longer exist`,
    notes:  'These internal properties were never intended to be public API and have been removed.',
  },
  'remove-beta-namespace': {
    before: `import { MongoClient } from 'mongodb/beta';`,
    after:  `import { MongoClient } from 'mongodb';`,
    notes:  "The 'mongodb/beta' export has been removed.",
  },
  'aws-explicit-credentials': {
    before: `new MongoClient('mongodb://AKID:SECRET@host/?authMechanism=MONGODB-AWS')`,
    after:  `new MongoClient('mongodb://host/?authMechanism=MONGODB-AWS')`,
    notes:  'Explicit AWS credentials in the URI are no longer accepted. Use @aws-sdk/credential-providers.',
  },
  'mongodb-cr-auth': {
    before: `new MongoClient(uri, { authMechanism: 'MONGODB-CR' })`,
    after:  `new MongoClient(uri, { authMechanism: 'SCRAM-SHA-256' })`,
    notes:  'MONGODB-CR was removed from MongoDB server in 4.0. Use SCRAM-SHA-256.',
  },
  'client-metadata-props': {
    before: `client.options.additionalDriverInfo`,
    after:  `// remove — internal property, not public API`,
    notes:  'These metadata properties on MongoOptions were internal. Remove any access to them.',
  },
  'cursor-implicit-batch-size': {
    before: `collection.find({}, { batchSize: 1000 })`,
    after:  `collection.find({})  // or keep batchSize if intentional`,
    notes:  'The driver no longer sets a default batchSize of 1000. Review whether this was intentional.',
  },
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
};

export function explainBreakingChange({ id }: { id: string }): ExplainResult {
  const codemod = getById(id);
  if (!codemod) throw new Error(`Unknown codemod: ${id}`);

  const example = EXAMPLES[id] ?? {
    before: '(no example available)',
    after:  '(no example available)',
    notes:  '',
  };

  return {
    id,
    description: codemod.description,
    kind: codemod.kind,
    hop: codemod.hop,
    ...example,
    docsUrl: DOCS_BASE,
  };
}
