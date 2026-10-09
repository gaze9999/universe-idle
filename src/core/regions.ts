import { environment, planet } from './world';
import type { World } from './world';

export const regionIds = ['home', 'upland', 'coast'] as const;
export type RegionId = typeof regionIds[number];

/** generator 1 的簡化區域模型; 目前產線固定在 home, 查看其他區域不改變生產 */
export function regionEnvironment(world: World, region: RegionId) {
  const base = environment(world);
  if (region === 'home') return base;
  const moisture = planet(world).moisture * (region === 'upland' ? .75 : 1.15);
  return { ...base, moisture, factors: { ...base.factors,
    wood: base.factors.wood * (region === 'upland' ? .8 : 1.1),
    stone: base.factors.stone * (region === 'upland' ? 1.2 : .9),
    food: base.factors.food * (region === 'upland' ? .75 : 1.15),
    build: base.factors.build * (region === 'upland' ? .9 : 1),
  } };
}
