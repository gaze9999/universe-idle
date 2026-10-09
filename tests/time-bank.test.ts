import { describe, expect, it } from 'vitest';
import { advance, createGame, execute } from '../src/core/game';
import { bankLimit, creditTime, defaultTimeBank, spendTime } from '../src/core/time-bank';
import { regionEnvironment } from '../src/core/regions';
import { environment, initialWorld } from '../src/core/world';
import { bankMigrationKey, defaultPreferences, encodeSave, parseSave, saveKey, writeSave } from '../src/platform/save';

describe('time bank and save migration', () => {
  it('converts 6 offline hours to 4 bank hours, caps at 8 hours and ignores negative gaps', () => {
    const first = creditTime(defaultTimeBank(), 6 * 3600);
    expect(first.received).toBe(4 * 3600);
    expect(creditTime(first.bank, 12 * 3600).bank.seconds).toBe(bankLimit);
    expect(creditTime(first.bank, -1).bank).toEqual(first.bank);
  });
  it('automatically spends available credit, ignores the former switch and returns to 1x', () => {
    const spending = spendTime({ seconds: .1, enabled: true }, .25);
    expect(spending.bank.seconds).toBe(0);
    expect(spending.simulationSeconds).toBeCloseTo(.35);
    expect(spendTime({ seconds: 10, enabled: false }, .25)).toMatchObject({ bank: { seconds: 9.75, enabled: true }, simulationSeconds: .5 });
  });
  it('maps accelerated completion to the actual date while preserving the normal simulation result', () => {
    const state = createGame(); state.resources.wood = 30; state.resources.stone = 20; state.assignments.base.build = 1;
    expect(execute(state, { type: 'build', id: 'habitat' })).toBeNull();
    state.task!.progress = state.task!.work - .05;
    const normal = structuredClone(state);
    advance(normal, 2);
    advance(state, 2, 1_800_000_000_000, 1);
    expect(state.buildings).toEqual(normal.buildings);
    expect(state.resources).toEqual(normal.resources);
    const date = state.achievements.settlement;
    expect(date).toBeGreaterThanOrEqual(1_800_000_000_000);
    expect(date).toBeLessThanOrEqual(1_800_000_001_000);
  });
  it('keeps exact v3 bytes, preserves world and assignments, and starts the migrated bank empty', () => {
    const state = createGame(); state.assignments.base.wood = 2;
    const raw = JSON.parse(encodeSave(state, defaultPreferences, 1000)); raw.version = 3; delete raw.timeBank;
    const original = JSON.stringify(raw); const loaded = parseSave(original);
    expect(loaded.state).toEqual(state); expect(loaded.timeBank).toEqual(defaultTimeBank());
    const data = new Map([[saveKey, original]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) } as Storage;
    const next = encodeSave(state, defaultPreferences, 2000, { seconds: 60, enabled: true });
    writeSave(storage, next); writeSave(storage, next);
    expect(data.get(bankMigrationKey)).toBe(original);
    expect(parseSave(data.get(saveKey)!).timeBank.seconds).toBe(60);
  });
  it('rejects invalid bank amounts and switches at the external save boundary', () => {
    for (const timeBank of [{ seconds: -1, enabled: true }, { seconds: bankLimit + 1, enabled: true }, { seconds: null, enabled: true }, { seconds: 1, enabled: 'true' }]) {
      const raw = JSON.parse(encodeSave(createGame(), defaultPreferences, 1000)); raw.timeBank = timeBank;
      expect(() => parseSave(JSON.stringify(raw))).toThrow('invalidSave');
    }
  });
  it('keeps the home environment identical and derives consistent upland/coast differences', () => {
    const world = initialWorld(42);
    expect(regionEnvironment(world, 'home')).toEqual(environment(world));
    expect(regionEnvironment(world, 'upland').factors.stone).toBeGreaterThan(environment(world).factors.stone);
    expect(regionEnvironment(world, 'coast').moisture).toBeGreaterThan(environment(world).moisture);
    expect(regionEnvironment(world, 'coast').weather).toBe(environment(world).weather);
  });
});
