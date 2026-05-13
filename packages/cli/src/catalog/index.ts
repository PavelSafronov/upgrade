import type { Codemod } from './types.js';
import { v5Codemods } from './v5/index.js';
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
import timeoutOptions from './v7/timeout-options/transform.js';
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
  { id: 'timeout-options', description: 'Flag socketTimeoutMS / waitQueueTimeoutMS deprecated in v6.11 in favour of timeoutMS', kind: 'semantic', hop, packages: pkg, transform: timeoutOptions },
  ...v7EnvChecks.map(e => ({
    ...e,
    kind: 'env' as const,
    hop,
    packages: pkg,
  })),
];

export const catalog: Codemod[] = [...v5Codemods, ...v6Codemods, ...v7Codemods];

export function getCatalog(packages = ['mongodb']): Codemod[] {
  return catalog.filter(c => c.packages.some(p => packages.includes(p)));
}

export function getById(id: string): Codemod | undefined {
  return catalog.find(c => c.id === id);
}
