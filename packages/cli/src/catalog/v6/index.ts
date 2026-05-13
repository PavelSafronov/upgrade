import type { Codemod } from '../types.js';
import removeConnectionOptions from './remove-connection-options/transform.js';
import bulkResultProps from './bulk-result-props/transform.js';
import writeConcernOptions from './write-concern-options/transform.js';
import boolCoerce from './bool-coerce/transform.js';
import {
  transformAddUser,
  transformCollectionStats,
  transformFindOneAnd,
  transformWithTransaction,
} from './semantic/transform.js';
import { v6EnvChecks } from '../../env/v6.js';

const hop = { from: '5.x', to: '6.x' };
const pkg = ['mongodb'];

export const v6Codemods: Codemod[] = [
  {
    id: 'remove-connection-options-v6',
    description: 'Remove deprecated SSL and keepAlive connection options',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: removeConnectionOptions,
  },
  {
    id: 'bulk-result-props',
    description: 'Replace removed BulkWriteResult properties (nInserted etc.) with undefined + TODO',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: bulkResultProps,
  },
  {
    id: 'db-adduser-removed',
    description: 'Flag db.addUser() / admin.addUser() removed in v6',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformAddUser,
  },
  {
    id: 'collection-stats-removed',
    description: 'Flag collection.stats() removed in v6',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformCollectionStats,
  },
  {
    id: 'findoneand-metadata',
    description: 'Flag findOneAndUpdate/Replace/Delete calls missing includeResultMetadata',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformFindOneAnd,
  },
  {
    id: 'withtransaction-return',
    description: 'Flag withTransaction return value usage (always void in v6)',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformWithTransaction,
  },
  {
    id: 'write-concern-options',
    description: 'Flag top-level write concern options (j, w, wtimeout) removed in v6',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: writeConcernOptions,
  },
  {
    id: 'bool-coerce',
    description: 'Convert numeric boolean options (tls: 1 → tls: true) — coercion removed in v6',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: boolCoerce,
  },
  ...v6EnvChecks.map(e => ({
    ...e,
    kind: 'env' as const,
    hop,
    packages: pkg,
  })),
];
