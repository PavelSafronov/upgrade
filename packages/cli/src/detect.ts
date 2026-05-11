import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as semver from 'semver';

export interface DetectResult {
  package: string;
  current: string;
}

export function detect(cwd: string): DetectResult | null {
  let raw: string;
  try {
    raw = readFileSync(join(cwd, 'package.json'), 'utf8');
  } catch {
    return null;
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const deps: Record<string, string> = {
    ...((pkg['dependencies'] as Record<string, string>) ?? {}),
    ...((pkg['devDependencies'] as Record<string, string>) ?? {}),
  };

  const rawVersion = deps['mongodb'];
  if (!rawVersion) return null;

  const coerced = semver.coerce(rawVersion);
  if (!coerced) return null;

  return { package: 'mongodb', current: coerced.version };
}
