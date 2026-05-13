import { describe, it, expect } from 'vitest';
import { parseMongodb, deriveMajorVersion, buildGraphQLQuery, formatSummary } from './gh-search.js';
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

describe('buildGraphQLQuery', () => {
  it('generates aliased repository fields for each batch item', () => {
    const batch = [
      { owner: 'org1', name: 'repo1', path: 'package.json' },
      { owner: 'org2', name: 'repo2', path: 'frontend/package.json' },
    ];
    const query = buildGraphQLQuery(batch);
    expect(query).toContain('r0: repository(owner: "org1", name: "repo1")');
    expect(query).toContain('r1: repository(owner: "org2", name: "repo2")');
    expect(query).toContain('expression: "HEAD:package.json"');
    expect(query).toContain('expression: "HEAD:frontend/package.json"');
    expect(query).toContain('... on Blob { text }');
  });

  it('wraps output in braces', () => {
    const query = buildGraphQLQuery([{ owner: 'a', name: 'b', path: 'package.json' }]);
    expect(query.trim()).toMatch(/^\{[\s\S]*\}$/);
  });
});

describe('formatSummary', () => {
  const repos: RepoEntry[] = [
    { owner: 'a', name: 'b', stars: 10, mongodbVersion: '^4.0.0', majorVersion: 4, depType: 'dependencies', packageJsonPath: 'package.json', url: 'https://github.com/a/b' },
    { owner: 'c', name: 'd', stars: 5, mongodbVersion: '^4.13.0', majorVersion: 4, depType: 'dependencies', packageJsonPath: 'package.json', url: 'https://github.com/c/d' },
    { owner: 'e', name: 'f', stars: 1, mongodbVersion: '^6.0.0', majorVersion: 6, depType: 'dependencies', packageJsonPath: 'package.json', url: 'https://github.com/e/f' },
  ];

  it('includes version group labels', () => {
    const out = formatSummary(repos, 300, 5, '/some/path', '2026-05-13');
    expect(out).toContain('v4.x');
    expect(out).toContain('v6.x');
  });

  it('includes the total line with limit and discarded count', () => {
    const out = formatSummary(repos, 300, 5, '/some/path', '2026-05-13');
    expect(out).toContain('Total: 3 repos');
    expect(out).toContain('300 query limit, 5 discarded');
  });

  it('includes the output path', () => {
    const out = formatSummary(repos, 300, 5, '/output/path.json', '2026-05-13');
    expect(out).toContain('/output/path.json');
  });

  it('handles empty repos list without throwing', () => {
    expect(() => formatSummary([], 300, 0, '/path', '2026-05-13')).not.toThrow();
  });
});
