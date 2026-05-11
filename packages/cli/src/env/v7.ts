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

export const nodeVersionCheck: EnvCheck = (cwd) => {
  const pkg = readPkg(cwd);
  const engines = (pkg['engines'] as Record<string, string> | undefined) ?? {};
  const current = engines['node'] ?? '';
  const required = '>=20.19.0';
  if (current && semver.satisfies('20.19.0', current)) return { status: 'ok', message: 'Node version requirement is satisfied' };
  engines['node'] = required;
  pkg['engines'] = engines;
  writePkg(cwd, pkg);
  return { status: 'warn', message: `Updated engines.node to ${required}`, autoFixed: true };
};

export const mongodbDepBump: EnvCheck = (cwd) => {
  const pkg = readPkg(cwd);
  const deps = (pkg['dependencies'] as Record<string, string> | undefined) ?? {};
  const devDeps = (pkg['devDependencies'] as Record<string, string> | undefined) ?? {};
  const target = '^7.0.0';

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

function peerDepBump(name: string, target: string): EnvCheck {
  return (cwd) => {
    const pkg = readPkg(cwd);
    const deps = (pkg['dependencies'] as Record<string, string> | undefined) ?? {};
    const devDeps = (pkg['devDependencies'] as Record<string, string> | undefined) ?? {};
    const peerDeps = (pkg['peerDependencies'] as Record<string, string> | undefined) ?? {};

    for (const [section, map] of [['dependencies', deps], ['devDependencies', devDeps], ['peerDependencies', peerDeps]] as const) {
      if ((map as Record<string, string>)[name]) {
        (map as Record<string, string>)[name] = target;
        pkg[section] = map;
        writePkg(cwd, pkg);
        return { status: 'warn', message: `Bumped ${name} to ${target} in ${section}`, autoFixed: true };
      }
    }
    return { status: 'ok', message: `${name} not found (nothing to bump)` };
  };
}

export const v7EnvChecks = [
  { id: 'node-version', description: 'Update engines.node to >=20.19.0', check: nodeVersionCheck },
  { id: 'mongodb-dep-bump', description: 'Bump mongodb dependency to ^7.0.0', check: mongodbDepBump },
  { id: 'bson-dep-bump', description: 'Bump bson to ^7.0.0 if present', check: peerDepBump('bson', '^7.0.0') },
  { id: 'peer-dep-kerberos', description: 'Bump kerberos to ^7.0.0 if present', check: peerDepBump('kerberos', '^7.0.0') },
  { id: 'peer-dep-zstd', description: 'Bump @mongodb-js/zstd to ^7.0.0 if present', check: peerDepBump('@mongodb-js/zstd', '^7.0.0') },
  { id: 'peer-dep-encryption', description: 'Bump mongodb-client-encryption to ^7.0.0 if present', check: peerDepBump('mongodb-client-encryption', '^7.0.0') },
];
