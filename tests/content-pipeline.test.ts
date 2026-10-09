import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
import gameData from '../content/game-data.json';
import { structures, researchDefs, spawnCosts } from '../src/core/content';
import { translate } from '../src/i18n';
const { validateRuntime } = createRequire(import.meta.url)('../tools/content-schema.cjs');
describe('public content catalog', () => {
  test('Core and bilingual UI consume the same validated catalog', () => {
    expect(validateRuntime(gameData)).toBe(gameData);
    expect(structures).toEqual(gameData.buildings); expect(researchDefs).toEqual(gameData.technologies); expect(spawnCosts).toEqual(gameData.spawnCosts);
    for (const [key, pair] of Object.entries(gameData.texts)) { expect(translate('zh-TW', key)).toBe(pair[0]); expect(translate('en', key)).toBe(pair[1]); }
  });
  test('build rejects private fields and unsupported content before packaging', () => {
    const privateField = { ...gameData, notes: 'private note' }; expect(() => validateRuntime(privateField)).toThrow();
    expect(() => validateRuntime({ ...gameData, contentVersion: 'future' })).toThrow();
    const cycle = structuredClone(gameData); cycle.buildings.laboratory.requires = 'arcana'; expect(() => validateRuntime(cycle)).toThrow(/循環/);
  });
});
