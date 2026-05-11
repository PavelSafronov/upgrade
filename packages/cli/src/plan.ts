import * as semver from 'semver';

export interface Hop {
  from: string;
  to: string;
}

const ALL_HOPS: Hop[] = [
  { from: '4.x', to: '5.x' },
  { from: '5.x', to: '6.x' },
  { from: '6.x', to: '7.x' },
];

export function buildPlan(current: string, toMajor = '7'): Hop[] {
  const currentMajor = semver.major(semver.coerce(current)!);
  const targetMajor = parseInt(toMajor, 10);
  return ALL_HOPS.filter(hop => {
    const fromMajor = parseInt(hop.from, 10);
    return fromMajor >= currentMajor && fromMajor < targetMajor;
  });
}
