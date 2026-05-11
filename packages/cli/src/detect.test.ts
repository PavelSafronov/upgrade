import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detect } from './detect.js';

function makeProject(dir: string, deps: Record<string, string>) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: deps }));
}

describe('detect', () => {
  let tmp: string;

  beforeEach(() => { tmp = join(tmpdir(), `upgrade-test-${Date.now()}`); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('returns version from dependencies', () => {
    makeProject(tmp, { mongodb: '^6.20.0' });
    expect(detect(tmp)).toEqual({ package: 'mongodb', current: '6.20.0' });
  });

  it('returns version from devDependencies', () => {
    makeProject(tmp, {});
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({
      devDependencies: { mongodb: '~5.8.1' }
    }));
    expect(detect(tmp)).toEqual({ package: 'mongodb', current: '5.8.1' });
  });

  it('returns null when mongodb is not installed', () => {
    makeProject(tmp, { express: '^4.0.0' });
    expect(detect(tmp)).toBeNull();
  });

  it('returns null when package.json does not exist', () => {
    mkdirSync(tmp, { recursive: true });
    expect(detect(tmp)).toBeNull();
  });
});
