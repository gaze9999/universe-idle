import { describe, expect, it } from 'vitest';
import { advance, assigned, createGame, execute, flow, planetSpeciesId } from '../src/core/game';
import { defaultPreferences, encodeSave, parseSave } from '../src/platform/save';

describe('gradual starvation and planetary assignments', () => {
  it('keeps productivity until deaths, removes idle units first and can reach zero', () => {
    const state = createGame(); state.resources.food = 0; execute(state, { type: 'assign', sp: 'base', job: 'wood', delta: 2 });
    const production = flow(state).raw.wood; advance(state, 59); expect(state.population.base).toBe(6); expect(flow(state).raw.wood).toBeCloseTo(production);
    advance(state, 1); expect(state.population.base).toBe(5); expect(state.assignments.base.wood).toBe(2);
    const records = structuredClone(state.log);
    advance(state, 300); expect(state.population.base).toBe(0); expect(assigned(state, 'base')).toBe(0);
    expect(state.log).toEqual(records);
    expect(parseSave(encodeSave(state, defaultPreferences, 1000)).state).toEqual(state);
  });
  it('preserves intermediate hunger across saves and matches segmented simulation', () => {
    const state = createGame(); state.resources.food = 0; execute(state, { type: 'assign', sp: 'base', job: 'wood', delta: 6 });
    advance(state, 37); const loaded = parseSave(encodeSave(state, defaultPreferences, 1000)).state;
    const split = structuredClone(loaded); advance(loaded, 323);
    for (let i = 0; i < 323; i++) advance(split, 1);
    expect(split.population).toEqual(loaded.population); expect(split.assignments).toEqual(loaded.assignments);
    expect(split.resources.wood).toBeCloseTo(loaded.resources.wood, 7); expect(split.stats.starvationSeconds).toBeCloseTo(loaded.stats.starvationSeconds!, 7);
  });
  it('clears hunger after food recovers and keeps separate planet states isolated', () => {
    const one = createGame(), two = createGame({ ...one.world, seed: one.world.seed + 1 }); one.resources.food = 0;
    advance(one, 30); expect(one.stats.starvationSeconds).toBe(30);
    execute(one, { type: 'assign', sp: 'base', job: 'food', delta: 2 }); advance(one, 1); expect(one.stats.starvationSeconds).toBe(0);
    expect(two.assignments.base.food).toBe(0); expect(two.elapsed).toBe(0); expect(planetSpeciesId(one)).not.toBe(planetSpeciesId(two));
  });
  it('defaults older preferences to system appearance and validates new values', () => {
    const save = JSON.parse(encodeSave(createGame(), defaultPreferences, 1000)); delete save.preferences.theme; delete save.preferences.appearance;
    expect(parseSave(JSON.stringify(save)).preferences).toEqual(defaultPreferences);
    save.preferences.appearance = 'unexpected'; expect(() => parseSave(JSON.stringify(save))).toThrow('invalidSave');
  });
  it('clears current-run hunger on both restarts while preserving severe-weather progress', () => {
    for (const abandon of [false, true]) {
      const state = createGame(); state.stats = { severeSeconds: 100, starvationSeconds: 30 }; state.world.age = 100;
      state.buildings.push('habitat', 'lumberyard', 'warehouse', 'laboratory', 'workshop', 'monument'); state.research.push('crafting', 'planning');
      expect(execute(state, { type: 'reset', start: 'base', abandon })).toBeNull();
      expect(state.stats).toEqual({ severeSeconds: 100, starvationSeconds: 0 }); expect(state.population.base).toBe(6);
      expect(state.world.age).toBe(100); expect(state.starGod).toBeNull();
      expect(parseSave(encodeSave(state, defaultPreferences, 1000)).state).toEqual(state);
    }
  });
});
