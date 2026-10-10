import { describe, expect, it } from 'vitest';
import { jobs, resources, starGodDefs, starGodIds } from '../src/core/content';
import { advance, createGame, execute, flow } from '../src/core/game';

describe('current-run deity choices', () => {
  it('allows one manual choice per run and clears it on either restart', () => {
    const s = createGame(); expect(s.starGod).toBeNull();
    expect(execute(s, { type: 'starGod', id: 'grove' })).toBeNull();
    expect(execute(s, { type: 'starGod', id: 'peak' })).toBe('starGodLocked'); expect(s.starGod).toBe('grove');
    expect(execute(s, { type: 'reset', start: 'base', abandon: true })).toBeNull(); expect(s.starGod).toBeNull();
    execute(s, { type: 'starGod', id: 'insight' }); s.buildings.push('monument');
    expect(execute(s, { type: 'reset', start: 'base' })).toBeNull(); expect(s.starGod).toBeNull(); expect(s.legacy.points).toBe(10);
  });
  for (const id of starGodIds) it(`${id} applies its bonuses only to the declared jobs`, () => {
    for (const job of jobs) {
      const s = createGame(); s.resources.wood = 100; s.resources.food = 100; s.buildings.push('workshop', 'laboratory'); s.assignments.base[job] = 1;
      const base = flow(s); execute(s, { type: 'starGod', id }); const next = flow(s); const multiplier = 1 + (starGodDefs[id][job] ?? 0);
      const value = (f: ReturnType<typeof flow>) => job === 'build' ? f.buildSpeed : job === 'craft' ? f.plankProduction : job === 'food' ? f.rates.food + s.population.base * .05 : f.rates[job === 'research' ? 'knowledge' : job];
      expect(value(next)).toBeCloseTo(value(base) * multiplier, 10);
    }
  });
  it('keeps long settlement equivalent to smaller steps across work completion and environment changes', () => {
    const s = createGame(); s.resources.wood = 100; s.resources.stone = 100;
    s.assignments.base = { wood: 2, stone: 1, food: 1, build: 2, craft: 0, research: 0 };
    execute(s, { type: 'starGod', id: 'frontier' }); execute(s, { type: 'build', id: 'habitat' });
    const split = structuredClone(s); advance(s, 3600); for (let i = 0; i < 360; i++) advance(split, 10);
    for (const r of resources) expect(split.resources[r]).toBeCloseTo(s.resources[r], 7);
    expect(split.buildings).toEqual(s.buildings); expect(split.starGod).toBe('frontier'); expect(split.world.age).toBeCloseTo(s.world.age, 7);
  });
});
