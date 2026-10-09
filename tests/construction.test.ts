import { describe, expect, it } from 'vitest';
import { resources } from '../src/core/content';
import { advance, capacity, checkAchievements, count, createGame, execute, flow, populationCapacity, queueCapacity, queueReason, researchReason, slots, taskDef } from '../src/core/game';
import { environment, initialWorld, planet } from '../src/core/world';
import { defaultPreferences, encodeSave, parseSave } from '../src/platform/save';
import { project } from '../src/ui/projection';

describe('repeatable buildings and construction queue', () => {
  it('starts with two total slots, including paid or paused construction and unpaid projects', () => {
    const s = createGame();
    expect(queueCapacity(s)).toBe(2);
    for (let n = 0; n < 2; n++) expect(execute(s, { type: 'build', id: 'habitat' })).toBeNull();
    expect(execute(s, { type: 'build', id: 'habitat' })).toBe('queueFull');
    s.resources.wood = 100; s.resources.stone = 100; advance(s, .001);
    expect(s.task?.id).toBe('habitat'); expect(s.queue).toEqual(['habitat']);
    execute(s, { type: 'pauseBuild' }); expect(execute(s, { type: 'build', id: 'habitat' })).toBe('queueFull');
    execute(s, { type: 'removeQueued', index: 0 }); expect(execute(s, { type: 'build', id: 'habitat' })).toBeNull();
  });
  it('expands through completed workshops and purchased planning, caps at twelve and resets to two', () => {
    const s = createGame(); s.buildings.push('habitat', 'lumberyard', 'warehouse', 'laboratory'); s.research.push('crafting');
    s.resources.wood = 1000; s.resources.stone = 1000; s.resources.knowledge = 1000; s.resources.food = 1000;
    s.assignments.base.build = 1;
    expect(execute(s, { type: 'build', id: 'workshop' })).toBeNull(); expect(queueCapacity(s)).toBe(2);
    advance(s, 500); expect(count(s, 'workshop')).toBe(1); expect(queueCapacity(s)).toBe(3);
    expect(execute(s, { type: 'research', id: 'planning' })).toBeNull(); expect(queueCapacity(s)).toBe(5);
    s.buildings.push(...Array(9).fill('workshop')); expect(queueCapacity(s)).toBe(12);
    s.queuePaused = true;
    for (let n = 0; n < 12; n++) expect(execute(s, { type: 'build', id: n < 9 ? 'habitat' : 'lumberyard' })).toBeNull();
    expect(execute(s, { type: 'build', id: 'warehouse' })).toBe('queueFull');
    expect(parseSave(encodeSave(s, defaultPreferences, 1000)).state).toEqual(s);
    execute(s, { type: 'reset', start: 'base', abandon: true }); expect(queueCapacity(s)).toBe(2);
  });
  it('preserves older over-capacity queues through import, reorder and removal, then accepts new projects below capacity', () => {
    const s = createGame(); s.buildings.push('habitat', 'lumberyard'); s.resources.wood = 100; s.resources.stone = 100;
    execute(s, { type: 'build', id: 'lumberyard' });
    s.queue = [...Array(9).fill('habitat'), ...Array(3).fill('lumberyard')];
    const restored = parseSave(encodeSave(s, defaultPreferences, 1000)).state;
    expect(restored).toEqual(s); expect(queueCapacity(restored)).toBe(2); expect(queueReason(restored, 'warehouse')).toBe('queueFull');
    expect(execute(restored, { type: 'reorderQueued', from: 11, to: 0 })).toBeNull(); expect(restored.queue[0]).toBe('lumberyard');
    for (let n = 0; n < 12; n++) expect(execute(restored, { type: 'removeQueued', index: 0 })).toBeNull();
    expect(restored.task).toEqual(s.task); expect(restored.resources).toEqual(s.resources);
    expect(execute(restored, { type: 'build', id: 'warehouse' })).toBeNull(); expect(restored.queue).toEqual(['warehouse']);
    expect(parseSave(encodeSave(restored, defaultPreferences, 1000)).state).toEqual(restored);
  });
  it('waits for materials, pays once at start and completes repetitions with distinct costs and no new population', () => {
    const s = createGame();
    s.assignments.base = { wood: 2, stone: 2, food: 1, build: 1, craft: 0, research: 0 };
    expect(execute(s, { type: 'build', id: 'habitat' })).toBeNull();
    expect(execute(s, { type: 'build', id: 'habitat' })).toBeNull();
    expect(s.task).toBeNull(); expect(s.queue).toEqual(['habitat', 'habitat']); expect(s.resources.wood).toBe(0);
    advance(s, 1000, 1_800_000_000_000);
    expect(count(s, 'habitat')).toBe(2); expect(s.queue).toEqual([]); expect(s.task).toBeNull();
    expect(taskDef('habitat', 1)).toEqual({ cost: { wood: 38, stone: 25 }, work: 69 });
    expect(populationCapacity(s, 'mineral')).toBe(4); expect(s.population.mineral).toBe(0);
    expect(project(s).tasks).toContain('habitat');
  });
  it('settles full offline intervals identically with queued starts, changing bonuses and resource boundaries', () => {
    for (let seed = 0; seed < 25; seed++) {
      const s = createGame(initialWorld(seed));
      s.buildings.push('habitat', 'lumberyard', 'warehouse', 'laboratory', ...Array(8).fill('workshop')); s.research.push('crafting');
      checkAchievements(s, 1_800_000_000_000);
      s.assignments.base = { wood: 2, stone: 2, food: 1, build: 1, craft: 0, research: 0 };
      for (let n = 0; n < 8; n++) expect(execute(s, { type: 'build', id: 'habitat' })).toBeNull();
      const split = structuredClone(s); const start = 1_800_000_000_000;
      advance(s, 86400, start);
      for (let at = 0; at < 86400; at += 43) advance(split, Math.min(43, 86400 - at), start + at * 1000);
      for (const r of resources) expect(split.resources[r]).toBeCloseTo(s.resources[r], 6);
      expect(split.queue).toEqual(s.queue); expect(split.buildings).toEqual(s.buildings); expect(split.achievements).toEqual(s.achievements);
      expect(split.task?.progress ?? 0).toBeCloseTo(s.task?.progress ?? 0, 6);
      expect(parseSave(encodeSave(s, defaultPreferences, start + 86400000)).state).toEqual(s);
    }
  });
  it('supports ordering and removing without consuming materials, while a paused queue does not start', () => {
    const s = createGame(); s.buildings.push('habitat'); s.resources.wood = 100; s.resources.stone = 100;
    execute(s, { type: 'pauseQueue' }); execute(s, { type: 'build', id: 'lumberyard' }); execute(s, { type: 'build', id: 'habitat' });
    const stock = { ...s.resources }; advance(s, 1); expect(s.task).toBeNull();
    expect(execute(s, { type: 'moveQueued', index: 1, delta: -1 })).toBeNull(); expect(s.queue).toEqual(['habitat', 'lumberyard']);
    expect(execute(s, { type: 'removeQueued', index: 0 })).toBeNull(); expect(s.resources.wood).toBe(stock.wood);
    execute(s, { type: 'pauseQueue' }); expect(s.task?.id).toBe('lumberyard'); expect(s.resources.wood).toBe(60);
    expect(execute(s, { type: 'removeQueued', index: 0 })).toBe('invalidQueue');
    expect(parseSave(encodeSave(s, defaultPreferences, 1000)).state).toEqual(s);
  });
  it('returns the actual paid repeat cost once, including overflow reserves', () => {
    const s = createGame(); s.buildings.push('habitat'); s.resources.wood = 200; s.resources.stone = 200;
    execute(s, { type: 'build', id: 'habitat' }); expect(s.task?.cost).toEqual({ wood: 38, stone: 25 });
    s.resources.wood = 200; s.resources.stone = 200;
    execute(s, { type: 'cancelBuild' }); expect(s.refund.wood).toBe(38); expect(s.refund.stone).toBe(25);
    expect(execute(s, { type: 'cancelBuild' })).toBe('noTask'); expect(s.refund.wood).toBe(38);
    expect(parseSave(encodeSave(s, defaultPreferences, 1000)).state).toEqual(s);
  });
  it('moves a waiting project across several positions without changing paid work or accepting invalid positions', () => {
    const s = createGame(); s.buildings.push('habitat', 'lumberyard', 'warehouse', 'laboratory', 'workshop'); s.research.push('crafting', 'planning'); s.queuePaused = true;
    for (const id of ['habitat', 'lumberyard', 'warehouse', 'habitat'] as const) execute(s, { type: 'build', id });
    expect(execute(s, { type: 'reorderQueued', from: 0, to: 2 })).toBeNull(); expect(s.queue).toEqual(['lumberyard', 'warehouse', 'habitat', 'habitat']);
    expect(execute(s, { type: 'reorderQueued', from: 2, to: 0 })).toBeNull(); expect(s.queue).toEqual(['habitat', 'lumberyard', 'warehouse', 'habitat']);
    const before = structuredClone(s);
    expect(execute(s, { type: 'reorderQueued', from: -1, to: 2 })).toBe('invalidQueue');
    expect(execute(s, { type: 'reorderQueued', from: 0, to: 4 })).toBe('invalidQueue');
    expect(execute(s, { type: 'reorderQueued', from: .5, to: 2 })).toBe('invalidQueue'); expect(s).toEqual(before);
  });
  it('keeps general construction unlimited while enforcing queue capacity', () => {
    const s = createGame(); s.buildings.push('habitat', 'lumberyard', 'warehouse', 'warehouse', 'laboratory', 'laboratory', 'workshop', 'workshop', 'camp', 'camp'); s.research.push('crafting');
    expect(capacity(s)).toBe(1800); expect(populationCapacity(s, 'base')).toBe(10); expect(slots(s, 'research')).toBe(4); expect(slots(s, 'craft')).toBe(2);
    s.buildings.push(...Array(7).fill('workshop')); s.research.push('planning'); expect(queueCapacity(s)).toBe(12);
    for (let n = 1; n < 10; n++) execute(s, { type: 'build', id: 'habitat' });
    expect(queueReason(s, 'habitat')).toBeNull();
    for (let n = 0; n < 3; n++) execute(s, { type: 'build', id: 'lumberyard' });
    expect(queueReason(s, 'warehouse')).toBe('queueFull');
    const raw = JSON.parse(encodeSave(s, defaultPreferences, 1000)); raw.state.buildings.push(...Array(10).fill('warehouse'));
    expect(parseSave(JSON.stringify(raw)).state.buildings).toEqual(raw.state.buildings);
  });
  it('round-trips more than 90 general buildings and population/work beyond the old limits', () => {
    const s = createGame();
    s.buildings.push('lumberyard', ...Array(20).fill('habitat'), ...Array(100).fill('warehouse'), ...Array(12).fill('laboratory'), ...Array(12).fill('workshop'), ...Array(20).fill('camp'));
    s.research.push('crafting', 'planning'); s.population = { base: 46, mineral: 40 };
    s.assignments.base.food = 26; s.assignments.base.research = 20; s.assignments.mineral.stone = 40;
    s.template = structuredClone(s.assignments); s.resources.food = 10000;
    expect(queueReason(s, 'habitat')).toBeNull(); expect(project(s).tasks).toContain('habitat');
    expect(parseSave(encodeSave(s, defaultPreferences, 1000)).state).toEqual(s);
    const invalid = structuredClone(s); invalid.population.base = 47;
    expect(() => parseSave(encodeSave(invalid, defaultPreferences, 1000))).toThrow('invalidSave');
    expect(execute(s, { type: 'build', id: 'monument' })).toBeNull();
    expect(queueReason(s, 'monument')).toBe('completed');
    const raw = JSON.parse(encodeSave(s, defaultPreferences, 1000)); raw.state.buildings.push('monument');
    expect(() => parseSave(JSON.stringify(raw))).toThrow('invalidSave');
  });
  it('shows positive potential rates at capacity while actual stock remains capped', () => {
    const s = createGame(); s.assignments.base.wood = 2; s.resources.wood = capacity(s);
    expect(flow(s).displayRates.wood).toBeGreaterThan(0); expect(flow(s).rates.wood).toBe(0);
    advance(s, 10); expect(s.resources.wood).toBe(capacity(s));
  });
});

describe('species, planetary conditions and permanent achievements', () => {
  function lab(seed: number) { const s = createGame(initialWorld(seed)); s.buildings.push('habitat', 'lumberyard', 'warehouse', 'laboratory'); s.resources.knowledge = 1000; return s; }
  it('opens research and buildings only when current species and stable planetary conditions match', () => {
    const s = lab(42); s.branch = 'forest'; s.legacy.discovered.push('forest');
    expect(researchReason(s, 'forestry')).toBeNull(); expect(researchReason(s, 'cultivation')).toBe('locked'); expect(researchReason(s, 'mineralogy')).toBe('locked');
    execute(s, { type: 'research', id: 'forestry' }); expect(project(s).tasks).toContain('grove');
    s.population.mineral = 1; expect(researchReason(s, 'mineralogy')).toBeNull(); execute(s, { type: 'research', id: 'mineralogy' }); expect(project(s).tasks).toContain('quarry');
    const drySeed = Array.from({ length: 100 }, (_, i) => i).find(i => planet(initialWorld(i)).moisture < 1)!;
    const dry = lab(drySeed); dry.branch = 'forest'; expect(researchReason(dry, 'forestry')).toBe('locked'); expect(project(dry).research).not.toContain('forestry');
    expect(parseSave(encodeSave(s, defaultPreferences, 1000)).state).toEqual(s);
  });
  it('records real timestamps once, retains bonuses through Reset and compounds only the applicable production', () => {
    const s = lab(42); s.resources.stone = 20; s.resources.food = 30; const at = 1_800_000_123_000;
    execute(s, { type: 'spawn', sp: 'mineral' }, at); expect(s.achievements.diversity).toBe(at);
    const before = structuredClone(s); delete before.achievements.diversity;
    before.assignments.mineral.stone = 1; s.assignments.mineral.stone = 1;
    expect(flow(s).displayRates.stone / flow(before).displayRates.stone).toBeCloseTo(1.02);
    advance(s, 10, at); expect(s.achievements.diversity).toBe(at);
    execute(s, { type: 'reset', start: 'base', abandon: true }, at + 10000); expect(s.achievements.diversity).toBe(at); expect(s.queue).toEqual([]);
    expect(parseSave(encodeSave(s, defaultPreferences, at + 10000)).state).toEqual(s);
  });
  it('uses stable magic potentials for eligibility and daily magic winds for research output', () => {
    const seed = Array.from({ length: 100 }, (_, i) => i).find(i => planet(initialWorld(i)).arcane >= .45)!;
    const s = lab(seed); s.research.push('crafting'); s.assignments.base.research = 1;
    const before = flow(s).displayRates.knowledge; execute(s, { type: 'research', id: 'arcana' }, 1000);
    expect(flow(s).displayRates.knowledge).toBeGreaterThan(before); expect(project(s).tasks).toContain('resonator');
    const split = structuredClone(s); advance(s, 86400, 1000);
    for (let i = 0; i < 1440; i++) advance(split, 60, 1000 + i * 60000);
    expect(split.resources.knowledge).toBeCloseTo(s.resources.knowledge, 6); expect(split.achievements).toEqual(s.achievements);
    const env = environment(s.world); expect(env.magic).toBeCloseTo(env.arcane * env.magicWind); expect(env.magicWind).toBeGreaterThanOrEqual(.7); expect(env.magicWind).toBeLessThan(1.3);
  });
});
