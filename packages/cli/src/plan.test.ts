import { describe, it, expect } from 'vitest';
import { buildPlan } from './plan.js';

describe('buildPlan', () => {
  it('plans a single hop for v6 → v7', () => {
    expect(buildPlan('6.20.0')).toEqual([{ from: '6.x', to: '7.x' }]);
  });

  it('plans two hops for v5 → v7', () => {
    expect(buildPlan('5.8.1')).toEqual([
      { from: '5.x', to: '6.x' },
      { from: '6.x', to: '7.x' },
    ]);
  });

  it('plans three hops for v4 → v7', () => {
    expect(buildPlan('4.13.0')).toEqual([
      { from: '4.x', to: '5.x' },
      { from: '5.x', to: '6.x' },
      { from: '6.x', to: '7.x' },
    ]);
  });

  it('respects explicit --to bound', () => {
    expect(buildPlan('5.8.1', '6')).toEqual([{ from: '5.x', to: '6.x' }]);
  });

  it('returns empty array if already at target', () => {
    expect(buildPlan('7.0.0')).toEqual([]);
  });
});
