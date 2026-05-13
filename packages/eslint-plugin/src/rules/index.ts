import type { Rule } from 'eslint';
import noObjectid from './v5/no-objectid.js';
import noV4Options from './v5/no-v4-options.js';
import noCursorCount from './v5/no-cursor-count.js';
import noV6ConnectionOptions from './v6/no-v6-connection-options.js';
import noBulkResultProps from './v6/no-bulk-result-props.js';
import noTopLevelWriteConcern from './v6/no-top-level-write-concern.js';
import noBetaNamespace from './v7/no-beta-namespace.js';
import noPoolRetryLabel from './v7/no-pool-retry-label.js';
import noDeprecatedClientOptions from './v7/no-deprecated-client-options.js';
import noDeprecatedTypes from './v7/no-deprecated-types.js';
import noDeprecatedGridfsOptions from './v7/no-deprecated-gridfs-options.js';
import noFindOneOptions from './v7/no-find-one-options.js';
import noFindOptionsGeneric from './v7/no-find-options-generic.js';
import noStreamTransform from './v7/no-stream-transform.js';
import noDeprecatedPropertyAccess from './v7/no-deprecated-property-access.js';

export const rules: Record<string, Rule.RuleModule> = {
  'no-objectid': noObjectid,
  'no-v4-options': noV4Options,
  'no-cursor-count': noCursorCount,
  'no-v6-connection-options': noV6ConnectionOptions,
  'no-bulk-result-props': noBulkResultProps,
  'no-top-level-write-concern': noTopLevelWriteConcern,
  'no-beta-namespace': noBetaNamespace,
  'no-pool-retry-label': noPoolRetryLabel,
  'no-deprecated-client-options': noDeprecatedClientOptions,
  'no-deprecated-types': noDeprecatedTypes,
  'no-deprecated-gridfs-options': noDeprecatedGridfsOptions,
  'no-find-one-options': noFindOneOptions,
  'no-find-options-generic': noFindOptionsGeneric,
  'no-stream-transform': noStreamTransform,
  'no-deprecated-property-access': noDeprecatedPropertyAccess,
};
