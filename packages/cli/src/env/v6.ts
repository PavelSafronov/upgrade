import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as semver from 'semver';
import type { EnvCheck } from '../catalog/types.js';

function readPkg(cwd: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
}

function writePkg(cwd: string, pkg: Record<string, unknown>): void {
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

const nodeVersionCheck: EnvCheck = (cwd) => {
  const pkg = readPkg(cwd);
  const engines = (pkg['engines'] as Record<string, string> | undefined) ?? {};
  const current = engines['node'] ?? '';
  const required = '>=16.20.1';
  if (current && semver.satisfies('16.20.1', current)) {
    return { status: 'ok', message: 'Node version requirement is satisfied' };
  }
  engines['node'] = required;
  pkg['engines'] = engines;
  writePkg(cwd, pkg);
  return { status: 'warn', message: `Updated engines.node to ${required}`, autoFixed: true };
};

const mongodbDepBump: EnvCheck = (cwd) => {
  const pkg = readPkg(cwd);
  const deps = (pkg['dependencies'] as Record<string, string> | undefined) ?? {};
  const devDeps = (pkg['devDependencies'] as Record<string, string> | undefined) ?? {};
  const target = '^6.0.0';

  if (deps['mongodb']) {
    deps['mongodb'] = target;
    pkg['dependencies'] = deps;
    writePkg(cwd, pkg);
    return { status: 'warn', message: `Bumped mongodb to ${target} in dependencies`, autoFixed: true };
  }
  if (devDeps['mongodb']) {
    devDeps['mongodb'] = target;
    pkg['devDependencies'] = devDeps;
    writePkg(cwd, pkg);
    return { status: 'warn', message: `Bumped mongodb to ${target} in devDependencies`, autoFixed: true };
  }
  return { status: 'ok', message: 'mongodb dependency not found (nothing to bump)' };
};

export const v6EnvChecks = [
  { id: 'node-version-v5to6', description: 'Update engines.node to >=16.20.1', check: nodeVersionCheck },
  { id: 'mongodb-dep-bump-v6', description: 'Bump mongodb dependency to ^6.0.0', check: mongodbDepBump },
];
