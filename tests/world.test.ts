import { describe, expect, it } from 'vitest';
import { advance, createGame, execute } from '../src/core/game';
import { environment, initialWorld, planet, productionFactor, seasons, speciesAptitude, universes } from '../src/core/world';
import { resources } from '../src/core/content';
import { backupKey, defaultPreferences, encodeSave, migrationKey, parseSave, readSave, saveKey, writeSave } from '../src/platform/save';

describe('world, seasons and inherited achievements', () => {
  it('generates stable planets and bounded variants while preserving species restrictions', () => {
    const rotations = new Set<number>();
    expect(planet(initialWorld(42))).toMatchObject({ rotation: 177, orbitDays: 20, moisture: 1.0412909190170467, tilt: 33, gravity: 0.9271477428730578 });
    for (const universe of universes) for (let seed = 0; seed < 100; seed++) {
      const world = initialWorld(seed, universe); const p = planet(world);
      expect(planet(structuredClone(world))).toEqual(p); expect(p.rotation).toBeGreaterThanOrEqual(120); expect(p.rotation).toBeLessThanOrEqual(240); rotations.add(p.rotation);
      expect(p.orbitDays % 4).toBe(0);
      expect(speciesAptitude(world, 'base', 'mineral', 'food')).toBe(0); expect(speciesAptitude(world, 'base', 'mineral', 'research')).toBe(0); expect(speciesAptitude(world, 'base', 'mineral', 'craft')).toBe(0);
      expect(speciesAptitude(world, 'base', 'mineral', 'stone')).toBeGreaterThan(speciesAptitude(world, 'base', 'base', 'stone'));
      expect(speciesAptitude(world, 'forest', 'base', 'wood')).toBeCloseTo(speciesAptitude(world, 'base', 'base', 'wood') * 1.5);
    }
    expect(rotations.size).toBeGreaterThan(20);
  });
  it('cycles through four seasons and responds to day/night, universe and severe weather', () => {
    const world = initialWorld(42); const p = planet(world);
    for (let i = 0; i < 4; i++) { world.age = p.rotation * p.orbitDays / 4 * i; expect(environment(world).season).toBe(seasons[i]); }
    world.age = 0; expect(environment(world).daylight).toBe(true); world.age = p.rotation / 2; expect(environment(world).daylight).toBe(false);
    expect(planet(initialWorld(42, 'dense')).gravity).toBe(1.35);
    for (let day = 0; day < 500; day++) {
      world.age = day * p.rotation;
      if (environment(world).weather === 'storm') {
        expect(productionFactor(world, 'mineral', 'build')).toBeGreaterThan(productionFactor(world, 'base', 'build'));
        expect(productionFactor(world, 'base', 'research')).toBe(1); return;
      }
    }
    throw new Error('No severe weather sampled');
  });
  it('settles a full offline day identically to irregular intervals across weather, food and construction', () => {
    for (const universe of universes) {
      const state = createGame(initialWorld(23, universe)); state.assignments.base = { wood: 2, stone: 2, food: 1, build: 1, craft: 0, research: 0 }; state.resources.wood = 30; state.resources.stone = 20;
      execute(state, { type: 'build', id: 'habitat' }); const split = structuredClone(state);
      advance(state, 86400, 1_800_000_000_000); let remaining = 86400;
      while (remaining > 0) { const dt = Math.min(remaining, 37); advance(split, dt, 1_800_000_000_000 + (86400 - remaining) * 1000); remaining -= dt; }
      for (const r of resources) expect(split.resources[r]).toBeCloseTo(state.resources[r], 6);
      expect(split.population).toEqual(state.population); expect(state.population.mineral).toBe(0); expect(split.buildings).toEqual(state.buildings);
      expect(split.world.age).toBeCloseTo(state.world.age, 6); expect(split.stats.severeSeconds).toBeCloseTo(state.stats.severeSeconds, 6);
      for (const id of Object.keys(state.achievements) as (keyof typeof state.achievements)[]) expect(split.achievements[id]).toBeCloseTo(state.achievements[id]!, 6);
    }
  });
  it('unlocks once and retains achievements and planetary time through Reset', () => {
    const state = createGame(); state.resources.stone = 30; state.resources.food = 30; state.buildings.push('habitat');
    execute(state, { type: 'spawn', sp: 'mineral' }); expect(state.achievements.diversity).toBeNull();
    const messages = state.log.filter(entry => entry.key === 'achievementUnlocked').length;
    advance(state, 10); expect(state.log.filter(entry => entry.key === 'achievementUnlocked')).toHaveLength(messages);
    const achievements = { ...state.achievements }; const world = { ...state.world }; execute(state, { type: 'reset', start: 'base', abandon: true });
    expect(state.achievements).toEqual(achievements); expect(state.world).toEqual(world); expect(state.population.mineral).toBe(0);
  });
});

describe('v1 migration and protected original', () => {
  function previousSave() {
    const state = createGame(); state.buildings.push('habitat'); state.population.mineral = 2; state.assignments.mineral.stone = 2; state.resources.stone = 40;
    state.elapsed = 500; const raw = JSON.parse(encodeSave(state, defaultPreferences, 1000));
    raw.version = 1; raw.state.schemaVersion = 1; raw.state.contentVersion = 'ground-v0.1'; delete raw.state.world; delete raw.state.achievements; delete raw.state.stats; delete raw.preferences.showCompleted;
    return JSON.stringify(raw);
  }
  it('migrates without changing resources, population, assignments or saved time and round-trips canonically', () => {
    const original = previousSave(); const old = JSON.parse(original); const loaded = parseSave(original);
    expect(loaded.version).toBe(4); expect(loaded.lastAt).toBe(1000); expect(loaded.state.resources).toEqual(old.state.resources); expect(loaded.state.population).toEqual(old.state.population); expect(loaded.state.assignments).toEqual(old.state.assignments);
    expect(loaded.state.world.age).toBe(500); expect(loaded.state.achievements.diversity).toBeNull(); expect(loaded.preferences.showCompleted).toBe(false);
    expect(parseSave(encodeSave(loaded.state, loaded.preferences, loaded.lastAt))).toEqual(loaded);
    old.state.population.mineral = 1; expect(() => parseSave(JSON.stringify(old))).toThrow('invalidSave');
  });
  it('keeps the exact old bytes through subsequent saves and preserves them when upgrade protection fails', () => {
    const data = new Map<string, string>(); const original = previousSave(); data.set(saveKey, original);
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) } as Storage;
    const loaded = parseSave(original); const next = encodeSave(loaded.state, loaded.preferences, 2000); writeSave(storage, next); writeSave(storage, next);
    expect(data.get(migrationKey)).toBe(original);
    expect(JSON.parse(data.get(backupKey)!).version).toBe(4);
    data.delete(migrationKey); data.set(saveKey, original); storage.setItem = (key, value) => { if (key === migrationKey) throw new Error('quota'); data.set(key, value); };
    expect(() => writeSave(storage, next)).toThrow('quota'); expect(data.get(saveKey)).toBe(original);
  });
  it('lets the earlier pending recruitment finish and reserves its habitat space', () => {
    const raw = JSON.parse(previousSave()); raw.state.buildings = ['habitat', 'lumberyard', 'warehouse', 'laboratory', 'workshop', 'camp']; raw.state.research = ['crafting']; raw.state.population.base = 7; raw.state.assignments.base.build = 1; raw.state.task = { id: 'recruit', progress: 20, paused: false };
    const state = parseSave(JSON.stringify(raw)).state;
    expect(execute(state, { type: 'spawn', sp: 'base' })).toBe('habitatFull'); advance(state, 100); expect(state.population.base).toBe(8); expect(state.task).toBeNull();
  });
  it('protects a recovered v1 backup before replacing an invalid primary', () => {
    const original = previousSave(); const data = new Map([[saveKey, '{damaged'], [backupKey, original]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) } as Storage;
    const recovered = readSave(storage); expect(recovered.notice).toBe('backupRecovered'); expect(recovered.blocked).toBe(false);
    const next = encodeSave(recovered.save!.state, recovered.save!.preferences, 2000);
    storage.setItem = (key, value) => { if (key === migrationKey) throw new Error('quota'); data.set(key, value); };
    expect(() => writeSave(storage, next)).toThrow('quota'); expect(data.get(backupKey)).toBe(original); expect(data.get(saveKey)).toBe('{damaged');
    storage.setItem = (key, value) => void data.set(key, value); writeSave(storage, next);
    expect(data.get(migrationKey)).toBe(original); expect(parseSave(data.get(backupKey)!)).toEqual(parseSave(original)); expect(data.get(saveKey)).toBe(next);
    expect(JSON.parse(data.get(backupKey)!).version).toBe(4);
  });
});
