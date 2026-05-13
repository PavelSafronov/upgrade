import type { Codemod } from '../types.js';
import objectidRename from './objectid-rename/transform.js';
import removeV4Options from './remove-v4-options/transform.js';
import cursorCount from './cursor-count/transform.js';
import {
  transformLegacyMethods,
  transformMapReduce,
  transformCallbackApi,
} from './semantic/transform.js';
import { v5EnvChecks } from '../../env/v5.js';

const hop = { from: '4.x', to: '5.x' };
const pkg = ['mongodb'];

export const v5Codemods: Codemod[] = [
  {
    id: 'objectid-rename',
    description: 'Rename ObjectID to ObjectId (deprecated alias removed in v5)',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: objectidRename,
  },
  {
    id: 'remove-v4-options',
    description: 'Remove deprecated MongoClient/BulkWrite options (slaveOk, promiseLibrary, keepGoing)',
    kind: 'mechanical',
    hop,
    packages: pkg,
    transform: removeV4Options,
  },
  {
    id: 'legacy-collection-methods',
    description: 'Flag collection.insert() / update() / remove() removed in v5',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformLegacyMethods,
  },
  {
    id: 'mapreduece-removed',
    description: 'Flag collection.mapReduce() removed in v5',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformMapReduce,
  },
  {
    id: 'callback-api',
    description: 'Flag callback-based MongoDB API calls removed in v5',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: transformCallbackApi,
  },
  {
    id: 'cursor-count',
    description: 'Flag cursor.count() removed in v5 (use countDocuments or estimatedDocumentCount)',
    kind: 'semantic',
    hop,
    packages: pkg,
    transform: cursorCount,
  },
  ...v5EnvChecks.map(e => ({
    ...e,
    kind: 'env' as const,
    hop,
    packages: pkg,
  })),
];
