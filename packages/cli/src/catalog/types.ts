import type { API, FileInfo, Options } from 'jscodeshift';
import type { Hop } from '../plan.js';

export type Transform = (
  file: FileInfo,
  api: API,
  options: Options
) => string | undefined;

export interface EnvCheckResult {
  status: 'ok' | 'warn' | 'error';
  message: string;
  autoFixed?: boolean;
}

export type EnvCheck = (cwd: string) => EnvCheckResult;

export interface Codemod {
  id: string;
  description: string;
  kind: 'mechanical' | 'semantic' | 'env';
  hop: Hop;
  packages: string[];
  transform?: Transform;
  check?: EnvCheck;
}
