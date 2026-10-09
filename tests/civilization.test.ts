import { describe, expect, it } from 'vitest';
import { advance, createGame, execute } from '../src/core/game';
import { developmentStages, initialCivilizationRelation, nativeArchetypes } from '../src/core/civilization';
import { initialWorld, nativeCivilization, planet, universes } from '../src/core/world';
import { defaultPreferences, encodeSave, parseSave } from '../src/platform/save';

describe('native civilization generation', () => {
  it('generates one stable native species with bounded development and distinct world IDs', () => {
    const ids = new Set<string>();
    const types = new Set<string>();
    const stages = new Set<string>();
    for (const universe of universes) for (let seed = 0; seed < 100; seed++) {
      const world = initialWorld(seed, universe);
      const civilization = nativeCivilization(world);
      expect(nativeCivilization({ ...world, age: 123456 })).toEqual(civilization);
      expect(nativeArchetypes).toContain(civilization.species.archetype);
      expect(developmentStages).toContain(civilization.development);
      ids.add(civilization.species.id); types.add(civilization.species.archetype); stages.add(civilization.development);
    }
    expect(ids.size).toBe(300); expect(types.size).toBe(nativeArchetypes.length); expect(stages.size).toBe(developmentStages.length);
    expect(planet(initialWorld(42))).toMatchObject({ rotation: 177, orbitDays: 20, moisture: 1.0412909190170467, tilt: 33, gravity: 0.9271477428730578 });
  });
  it('retains native identity through settlement advancement, save reload and ground Reset', () => {
    const state = createGame(initialWorld(42));
    const before = nativeCivilization(state.world);
    advance(state, 100);
    expect(nativeCivilization(parseSave(encodeSave(state, defaultPreferences, 1000)).state.world)).toEqual(before);
    expect(execute(state, { type: 'reset', start: 'base', abandon: true })).toBeNull();
    expect(nativeCivilization(state.world)).toEqual(before);
    expect(state.population).toEqual({ base: 6, mineral: 0 });
  });
  it('reserves separate uncontacted relations without inventing trade or colonial agreements', () => {
    const id = nativeCivilization(initialWorld(42)).id;
    const first = initialCivilizationRelation(id);
    const second = initialCivilizationRelation(id);
    expect(first).toEqual({ civilizationId: id, contact: 'uncontacted', tradeAgreementId: null, colonialSettlementId: null });
    first.contact = 'contacted'; expect(second.contact).toBe('uncontacted');
  });
});
