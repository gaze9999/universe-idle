import { describe, expect, it } from 'vitest';
import { emptyJobs, resources } from '../src/core/content';
import type { Assignments, Branch, Cost, TaskId } from '../src/core/content';
import { advance, canAfford, capacity, createGame, execute, flow, count, queueReason, reward, spawnReason, taskDef } from '../src/core/game';
import { environment } from '../src/core/world';
import type { GameState } from '../src/core/game';
import { backupKey, defaultPreferences, encodeSave, parseSave, readSave, saveKey, writeSave } from '../src/platform/save';

function configure(s: GameState, base: Partial<Assignments['base']>, mineral: Partial<Assignments['mineral']>): void {
  for (const sp of ['base', 'mineral'] as const) for (const job of Object.keys(s.assignments[sp]) as (keyof Assignments['base'])[]) {
    if (s.assignments[sp][job]) expect(execute(s, { type: 'assign', sp, job, delta: -s.assignments[sp][job] })).toBeNull();
  }
  for (const sp of ['base', 'mineral'] as const) for (const [job, delta] of Object.entries(sp === 'base' ? base : mineral)) {
    expect(execute(s, { type: 'assign', sp, job: job as keyof Assignments['base'], delta })).toBeNull();
  }
}
function wait(s: GameState, cost: Cost): void {
  for (let i = 0; !canAfford(s, cost); i++) {
    if (i > 5000) throw new Error('Cannot reach cost');
    const rates = flow(s).rates;
    let seconds = 0;
    for (const r of resources) if (s.resources[r] + 1e-8 < (cost[r] ?? 0)) seconds = Math.max(seconds, rates[r] > 0 ? ((cost[r] ?? 0) - s.resources[r]) / rates[r] : Infinity);
    advance(s, Math.min(seconds, environment(s.world).nextBoundary));
  }
}
function build(s: GameState, id: TaskId): void {
  wait(s, taskDef(id, id == 'recruit' ? 0 : count(s, id)).cost);
  expect(execute(s, { type: 'build', id })).toBeNull();
  for (let i = 0; s.task; i++) {
    if (i > 5000) throw new Error('Cannot complete task');
    const rate = flow(s).buildSpeed;
    expect(rate).toBeGreaterThan(0);
    advance(s, Math.min((s.task.work - s.task.progress) / rate, environment(s.world).nextBoundary));
  }
  expect(s.task).toBeNull();
}
function firstHabitat(s: GameState, spawn = true): void {
  configure(s, { wood: 2, stone: 2, food: 1, build: 1 }, {}); build(s, 'habitat');
  if (spawn) for (let i = 0; i < 2; i++) { wait(s, { stone: 10, food: 5 }); expect(execute(s, { type: 'spawn', sp: 'mineral' })).toBeNull(); }
}
export function fullRun(branch: Branch): GameState {
  const s = createGame();
  firstHabitat(s);
  expect(execute(s, { type: 'branch', id: branch })).toBeNull();
  configure(s, { wood: 3, food: 1, build: 2 }, { stone: 2 });
  for (const id of ['lumberyard', 'warehouse', 'laboratory'] as const) build(s, id);
  configure(s, { wood: 3, food: 1, research: 2 }, { stone: 2 });
  wait(s, { knowledge: 60 }); expect(execute(s, { type: 'research', id: 'crafting' })).toBeNull();
  configure(s, { wood: 3, food: 1 }, { stone: 2 });
  wait(s, taskDef('workshop').cost);
  configure(s, { wood: 3, food: 1, build: 2 }, { stone: 2 }); build(s, 'workshop');
  configure(s, { wood: 2, food: 1, craft: 1, research: 2 }, { stone: 2 });
  wait(s, { knowledge: 140 }); expect(execute(s, { type: 'research', id: 'planning' })).toBeNull();
  wait(s, taskDef('monument').cost);
  configure(s, { wood: 2, food: 1, research: 2, build: 1 }, { build: 2 }); build(s, 'monument');
  return s;
}
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, clear: () => data.clear(), key: n => [...data.keys()][n] ?? null, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k) };
}
describe('opening and full loop', () => {
  it('starts with idle workers, produces only after assignment, and starts a new run idle', () => {
    const s = createGame(); expect(s.assignments).toEqual({ base: emptyJobs(), mineral: emptyJobs() });
    advance(s, 60); expect(s.resources.wood).toBe(0); expect(s.resources.stone).toBe(0); expect(s.resources.food).toBeCloseTo(12);
    expect(execute(s, { type: 'assign', sp: 'base', job: 'wood', delta: 1 })).toBeNull(); expect(execute(s, { type: 'assign', sp: 'base', job: 'food', delta: 1 })).toBeNull();
    const rates = flow(s).rates; const food = s.resources.food;
    advance(s, 10); expect(s.resources.wood).toBeCloseTo(rates.wood * 10); expect(s.resources.food).toBeCloseTo(food + rates.food * 10);
    expect(execute(s, { type: 'reset', start: 'base', abandon: true })).toBeNull(); expect(s.assignments.base).toEqual(emptyJobs());
  });
  it('completes a habitat without creating population and pays separately for each generated unit', () => {
    const s = createGame(); firstHabitat(s, false);
    expect(s.elapsed).toBeGreaterThan(100); expect(s.population.mineral).toBe(0); expect(queueReason(s, 'habitat')).toBeNull();
    const stock = { ...s.resources }; expect(execute(s, { type: 'spawn', sp: 'mineral' })).toBeNull();
    expect(s.resources.stone).toBeCloseTo(stock.stone - 10); expect(s.resources.food).toBeCloseTo(stock.food - 5); expect(s.assignments.mineral).toEqual(emptyJobs());
    advance(s, 100); expect(s.population.mineral).toBe(1);
    wait(s, { stone: 10, food: 5 }); execute(s, { type: 'spawn', sp: 'mineral' }); expect(spawnReason(s, 'mineral')).toBe('habitatFull');
  });
  for (const branch of ['forest', 'symbiosis'] as const) it(`${branch} completes a real first loop and keeps legacy through one Reset`, () => {
    const s = fullRun(branch);
    expect(s.elapsed).toBeCloseTo(branch === 'forest' ? 3156.15594149665 : 4902.758182885828, 6);
    expect(reward(s)).toBe(10);
    const abandoned = structuredClone(s);
    expect(execute(abandoned, { type: 'reset', start: 'base', abandon: true })).toBeNull();
    expect(abandoned.legacy.points).toBe(0); expect(abandoned.legacy.resets).toBe(0);
    expect(s.resources.wood).toBeGreaterThan(0);
    const restored = parseSave(encodeSave(s, defaultPreferences, 100000)).state;
    expect(restored).toEqual(s);
    expect(execute(restored, { type: 'reset', start: 'base' })).toBeNull();
    expect(restored.legacy.points).toBe(10); expect(restored.legacy.resets).toBe(1); expect(restored.population).toEqual({ base: 6, mineral: 0 }); expect(restored.resources.food).toBe(30);
    expect(execute(restored, { type: 'reset', start: 'base' })).toBe('locked'); expect(restored.legacy.points).toBe(10);
    expect(execute(restored, { type: 'meta', id: 'startChoice' })).toBeNull();
    expect(execute(restored, { type: 'reset', start: branch, abandon: true })).toBeNull();
    expect(restored.branch).toBe(branch); expect(restored.legacy.points).toBe(0); expect(restored.legacy.resets).toBe(1);
  });
  it('optional population and expansions are reachable and reward each milestone once', () => {
    const s = fullRun('forest');
    configure(s, { wood: 2, food: 1, craft: 1, research: 2 }, { stone: 1, build: 1 });
    build(s, 'camp'); for (let i = 0; i < 2; i++) { wait(s, { wood: 30, food: 20 }); expect(execute(s, { type: 'spawn', sp: 'base' })).toBeNull(); } expect(s.population.base).toBe(8); expect(spawnReason(s, 'base')).toBe('habitatFull');
    build(s, 'habitat'); expect(s.population.mineral).toBe(2); for (let i = 0; i < 2; i++) { wait(s, { stone: 10, food: 5 }); expect(execute(s, { type: 'spawn', sp: 'mineral' })).toBeNull(); } expect(s.population.mineral).toBe(4);
    configure(s, { wood: 2, food: 1, craft: 1, research: 2, build: 2 }, { stone: 2, build: 2 });
    build(s, 'expansion1'); build(s, 'expansion2'); expect(reward(s)).toBe(20);
    expect(parseSave(encodeSave(s, defaultPreferences, 1000)).state).toEqual(s);
  });
});
describe('event boundaries and recovery', () => {
  it('long settlement equals small segments across starvation and habitat completion', () => {
    const s = createGame(); firstHabitat(s); configure(s, { wood: 4, build: 2 }, { stone: 2 });
    s.resources.wood = 80; s.resources.stone = 60; expect(execute(s, { type: 'build', id: 'lumberyard' })).toBeNull();
    const split = structuredClone(s); advance(s, 24 * 60 * 60); for (let i = 0; i < 1440; i++) advance(split, 60);
    for (const r of resources) expect(split.resources[r]).toBeCloseTo(s.resources[r], 7);
    expect(split.buildings).toEqual(s.buildings); expect(split.population).toEqual(s.population); expect(flow(s).starving).toBe(true);
    expect(execute(s, { type: 'assign', sp: 'base', job: 'wood', delta: -1 })).toBeNull(); expect(execute(s, { type: 'assign', sp: 'base', job: 'food', delta: 1 })).toBeNull();
    const rate = flow(s).rates.food; const wasStarving = flow(s).starving; advance(s, 10); expect(s.resources.food).toBeCloseTo(Math.max(0, rate * 10), 8); expect(wasStarving).toBe(rate <= 0);
  });
  it('crafting uses only available incoming wood and stops at capacity without consuming inputs', () => {
    const s = fullRun('forest'); s.branch = 'base'; s.resources.wood = 0; s.resources.planks = 0;
    configure(s, { wood: 1, craft: 1, food: 1 }, {});
    const split = structuredClone(s); advance(s, 10000); for (let i = 0; i < 1000; i++) advance(split, 10);
    for (const r of resources) expect(split.resources[r]).toBeCloseTo(s.resources[r], 7);
    expect(s.resources.planks).toBeGreaterThan(0); expect(flow(s).plankProduction).toBeLessThanOrEqual(flow(s).desiredPlanks);
    s.resources.planks = capacity(s); const before = s.resources.wood; const rate = flow(s).rates.wood; const dt = Math.min(10, environment(s.world).nextBoundary); advance(s, dt); expect(s.resources.wood).toBeCloseTo(before + rate * dt, 8); expect(s.resources.planks).toBe(1000);
  });
  it('pause preserves work; cancellation overflow is reserved and cannot create duplicate refunds', () => {
    const s = createGame(); configure(s, { wood: 2, stone: 2, food: 1, build: 1 }, {}); wait(s, taskDef('habitat').cost); execute(s, { type: 'build', id: 'habitat' }); advance(s, 10); const progress = s.task?.progress; execute(s, { type: 'pauseBuild' }); advance(s, 2000);
    expect(s.task?.progress).toBe(progress); expect(s.resources.wood).toBe(200);
    expect(execute(s, { type: 'cancelBuild' })).toBeNull(); expect(s.refund.wood).toBe(30); expect(s.refund.stone).toBe(20);
    expect(execute(s, { type: 'cancelBuild' })).toBe('noTask'); execute(s, { type: 'build', id: 'habitat' }); execute(s, { type: 'claimRefund' }); expect(s.resources.wood).toBe(200); expect(s.refund.wood).toBe(0);
  });
  it('rejects unavailable work, overassignment, duplicate research and repeat evolution', () => {
    const s = createGame(); expect(execute(s, { type: 'assign', sp: 'base', job: 'wood', delta: 7 })).toBe('workers');
    firstHabitat(s); expect(execute(s, { type: 'assign', sp: 'mineral', job: 'food', delta: 1 })).toBe('unsupported');
    expect(execute(s, { type: 'branch', id: 'forest' })).toBeNull(); expect(execute(s, { type: 'branch', id: 'symbiosis' })).toBe('locked');
    expect(execute(s, { type: 'research', id: 'crafting' })).toBe('locked');
    const complete = fullRun('forest'); expect(execute(complete, { type: 'research', id: 'crafting' })).toBe('completed');
  });
  it('templates respect population, unsupported work and station slots when reused', () => {
    const s = fullRun('forest'); s.legacy.templates = true; execute(s, { type: 'saveTemplate' }); execute(s, { type: 'reset', start: 'base' });
    expect(s.assignments.base).toEqual(emptyJobs()); expect(s.assignments.mineral).toEqual(emptyJobs());
    expect(execute(s, { type: 'applyTemplate' })).toBeNull(); expect(s.assignments.base.wood).toBe(2); expect(s.assignments.base.craft).toBe(0); expect(s.assignments.base.research).toBe(0);
    configure(s, { wood: 2, stone: 2, food: 1, build: 1 }, {});
    firstHabitat(s); expect(s.assignments.mineral.build).toBe(2);
  });
});
describe('save validation and atomic storage', () => {
  it('round-trips the canonical save; rejects corrupt, non-finite and impossible states', () => {
    const s = fullRun('forest'); const saved = encodeSave(s, defaultPreferences, 12345);
    expect(parseSave(saved).state).toEqual(s);
    for (const mutate of [(raw: Record<string, any>) => raw.state.resources.food = -1, (raw: Record<string, any>) => raw.state.assignments.base.wood = 30, (raw: Record<string, any>) => raw.state.population.mineral = 4, (raw: Record<string, any>) => raw.state.buildings = ['unknown'], (raw: Record<string, any>) => raw.state.schemaVersion = 4]) {
      const raw = JSON.parse(saved); mutate(raw); expect(() => parseSave(JSON.stringify(raw))).toThrow();
    }
    expect(() => parseSave('{broken')).toThrow(); expect(() => advance(s, Infinity)).toThrow(); expect(() => advance(s, -1)).toThrow();
  });
  it('keeps a previous valid save, recovers from corruption and blocks overwriting an unrecoverable original', () => {
    const storage = memoryStorage(); const first = encodeSave(createGame(), defaultPreferences, 1000); writeSave(storage, first);
    const later = createGame(); advance(later, 10); writeSave(storage, encodeSave(later, defaultPreferences, 2000)); expect(storage.getItem(backupKey)).toBe(first);
    storage.setItem(saveKey, '{broken'); expect(readSave(storage).notice).toBe('backupRecovered'); expect(readSave(storage).save?.lastAt).toBe(1000);
    storage.removeItem(backupKey); expect(readSave(storage).blocked).toBe(true); expect(storage.getItem(saveKey)).toBe('{broken');
  });
});
