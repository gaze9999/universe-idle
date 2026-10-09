import type { World } from '../world';

/** 以穩定欄位索引取樣, 新增屬性不改變其他欄位; 不依賴 UI tick 或呼叫次數 */
export function sample(seed: number, index: number): number {
  let x = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ x >>> 16, 0x21f0aaad);
  x = Math.imul(x ^ x >>> 15, 0x735a2d97);
  return ((x ^ x >>> 15) >>> 0) / 4294967296;
}
export function generatePlanet(world: World) {
  const rotation = 120 + Math.floor(sample(world.seed, 0) * 121);
  const orbitDays = 16 + Math.floor(sample(world.seed, 1) * 5) * 4;
  const moisture = .8 + sample(world.seed, 2) * .4;
  const tilt = 10 + Math.floor(sample(world.seed, 3) * 26);
  return { rotation, orbitDays, moisture, tilt, gravity: world.universe === 'dense' ? 1.35 : .9 + sample(world.seed, 4) * .2, arcane: .25 + sample(world.seed, 5) * .75, vitality: .25 + sample(world.seed, 6) * .75 };
}
