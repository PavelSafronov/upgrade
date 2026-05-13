import { describe, it, expect } from 'vitest';
import { parseMongodb, deriveMajorVersion } from './gh-search.js';
import type { RepoEntry } from './gh-search.js';

describe('parseMongodb', () => {
  it('returns version from dependencies', () => {
    const pkg = JSON.stringify({ dependencies: { mongodb: '^4.13.0' } });
    expect(parseMongodb(pkg)).toEqual({ version: '^4.13.0', depType: 'dependencies' });
  });

  it('returns version from devDependencies', () => {
    const pkg = JSON.stringify({ devDependencies: { mongodb: '~5.0.0' } });
    expect(parseMongodb(pkg)).toEqual({ version: '~5.0.0', depType: 'devDependencies' });
  });

  it('prefers dependencies over devDependencies when both present', () => {
    const pkg = JSON.stringify({
      dependencies: { mongodb: '^6.0.0' },
      devDependencies: { mongodb: '^5.0.0' },
    });
    expect(parseMongodb(pkg)).toEqual({ version: '^6.0.0', depType: 'dependencies' });
  });

  it('returns null when mongodb is absent', () => {
    const pkg = JSON.stringify({ dependencies: { express: '^4.0.0' } });
    expect(parseMongodb(pkg)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseMongodb('not json')).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(parseMongodb('{}')).toBeNull();
  });
});

describe('deriveMajorVersion', () => {
  it('handles caret ranges', () => expect(deriveMajorVersion('^4.13.0')).toBe(4));
  it('handles tilde ranges', () => expect(deriveMajorVersion('~3.6.0')).toBe(3));
  it('handles exact versions', () => expect(deriveMajorVersion('6.21.0')).toBe(6));
  it('handles >= ranges', () => expect(deriveMajorVersion('>=5.0.0')).toBe(5));
  it('handles v-prefix', () => expect(deriveMajorVersion('v7.0.0')).toBe(7));
  it('returns -1 for unrecognizable strings', () => expect(deriveMajorVersion('latest')).toBe(-1));
  it('returns -1 for empty string', () => expect(deriveMajorVersion('')).toBe(-1));
});
