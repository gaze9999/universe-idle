import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/core/game';
import { defaultPreferences, encodeSave, parseSave } from '../src/platform/save';
import { compressSave, importSave } from '../src/platform/transfer';

describe('lossless save transfers', () => {
  it('keeps Japanese and a selected deity in both formats, migrates absent selections and rejects unknown IDs', async () => {
    const state = createGame(); state.starGod = 'grove';
    const json = encodeSave(state, { ...defaultPreferences, language: 'ja' }, 1000);
    for (const payload of [json, await compressSave(json)]) {
      const restored = await importSave(payload);
      expect(restored.preferences.language).toBe('ja'); expect(restored.state.starGod).toBe('grove');
    }
    const old = JSON.parse(json); delete old.state.starGod;
    expect(parseSave(JSON.stringify(old)).state.starGod).toBeNull();
    old.state.starGod = 'unknown'; expect(() => parseSave(JSON.stringify(old))).toThrow('invalidSave');
  });
  it('compresses all progress and full-precision decimals and accepts both formats', async () => {
    const state = createGame(); state.resources.wood = .123456789012345; state.achievements.settlement = 1_800_000_123_456;
    const json = encodeSave(state, defaultPreferences, 1_800_000_123_456); const packed = await compressSave(json);
    expect(packed.startsWith('UI3.')).toBe(true); expect(packed.length).toBeLessThan(json.length);
    expect(await importSave(packed)).toEqual(parseSave(json)); expect(await importSave(json)).toEqual(parseSave(json));
  });
  it('rejects truncated, modified and excessive decompressed payloads', async () => {
    const json = encodeSave(createGame(), defaultPreferences, 1000); const packed = await compressSave(json);
    await expect(importSave(packed.slice(0, -8))).rejects.toThrow(); await expect(importSave('UI3.%%%')).rejects.toThrow();
    const excessive = await compressSave(' '.repeat(100001)); await expect(importSave(excessive)).rejects.toThrow('invalidSave');
  });
  it('falls back to complete JSON when compression is unavailable', async () => {
    const json = encodeSave(createGame(), defaultPreferences, 1000);
    vi.stubGlobal('CompressionStream', undefined);
    try {
      expect(await compressSave(json)).toBe(json);
      vi.stubGlobal('CompressionStream', class { constructor() { throw new Error('unavailable'); } });
      expect(await compressSave(json)).toBe(json);
    } finally { vi.unstubAllGlobals(); }
  });
  it('upgrades genuine v2 records with pending work and unknown real achievement dates', async () => {
    const s = createGame(); s.buildings.push('habitat'); s.population.mineral = 1;
    const raw = JSON.parse(encodeSave(s, defaultPreferences, 1000));
    raw.version = 2; raw.state.schemaVersion = 2; raw.state.contentVersion = 'ground-v0.2'; raw.state.elapsed = 400; raw.state.world.age = 400;
    raw.state.achievements = { settlement: 300, diversity: 400 }; raw.state.task = { id: 'lumberyard', progress: 25, paused: true };
    delete raw.state.queue; delete raw.state.queuePaused;
    const migrated = await importSave(await compressSave(JSON.stringify(raw)));
    expect(migrated.state.achievements).toEqual({ settlement: null, diversity: null });
    expect(migrated.state.task).toEqual({ id: 'lumberyard', progress: 25, paused: true, cost: { wood: 40, stone: 30 }, work: 90 });
    expect(migrated.state.queue).toEqual([]); expect(migrated.state.population.mineral).toBe(1);
    expect(parseSave(encodeSave(migrated.state, migrated.preferences, migrated.lastAt))).toEqual(migrated);
    raw.state.template = { base: { wood: 9, stone: 0, food: 0, build: 0, craft: 0, research: 0 }, mineral: { wood: 0, stone: 0, food: 0, build: 0, craft: 0, research: 0 } };
    expect(() => parseSave(JSON.stringify(raw))).toThrow('invalidSave');
  });
});
