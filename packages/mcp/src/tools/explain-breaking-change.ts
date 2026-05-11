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
