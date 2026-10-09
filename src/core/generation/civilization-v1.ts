import { developmentStages, nativeArchetypes } from '../civilization';
import type { NativeCivilization } from '../civilization';
import type { World } from '../world';
import { sample } from './v1';

/** v1 的獨立資訊欄位 20 / 21, 不改動天體 0~6, 工作 10 / 11 或日序天氣取樣 */
export function generateCivilization(world: World): NativeCivilization {
  const key = `${world.universe}-${world.seed.toString(16).padStart(8, '0')}`;
  return {
    id: `civilization-${key}`,
    species: { id: `native-${key}`, archetype: nativeArchetypes[Math.floor(sample(world.seed, 20) * nativeArchetypes.length)] },
    development: developmentStages[Math.floor(sample(world.seed, 21) * developmentStages.length)],
  };
}
