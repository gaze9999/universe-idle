import { generators } from './generation';
import type { Branch, Job, Species } from './content';
import { aptitude } from './content';

export const universes = ['standard', 'dense', 'volatile'] as const;
export type Universe = typeof universes[number];
export const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
export const weatherIds = ['clear', 'rain', 'drought', 'storm', 'frost'] as const;
export type Weather = typeof weatherIds[number];
/** seed 與 generatorVersion 固定天體及物種變種; age 為行星已結算秒數, 跨聚落輪次保留 */
export interface World { seed: number; generatorVersion: 1; universe: Universe; age: number }
export const initialWorld = (seed = 20261003, universe: Universe = 'standard'): World => ({ seed, generatorVersion: 1, universe, age: 0 });

export const planet = (world: World) => generators[world.generatorVersion].planet(world);
export const nativeCivilization = (world: World) => generators[world.generatorVersion].civilization(world);

export function environment(world: World) {
  const p = planet(world);
  const day = Math.floor((world.age + 1e-8) / p.rotation);
  const phase = Math.floor((world.age + 1e-8) / (p.rotation / 2));
  const season = seasons[Math.floor(day % p.orbitDays / (p.orbitDays / 4))];
  const roll = generators[world.generatorVersion].sample(world.seed, day + 100);
  const severe = world.universe === 'volatile' ? .16 : .08;
  const weather: Weather = roll < severe ? season === 'winter' ? 'frost' : 'storm' : roll < severe + .08 ? 'drought' : roll < severe + .3 ? 'rain' : 'clear';
  const daylight = phase % 2 === 0;
  const seasonalFood = season === 'spring' ? 1.1 : season === 'autumn' ? 1.05 : season === 'winter' ? 1 - p.tilt / 100 : 1;
  const weatherFactors: Record<Weather, { wood: number; stone: number; food: number; build: number }> = {
    clear: { wood: 1, stone: 1, food: 1, build: 1 }, rain: { wood: .9, stone: .95, food: 1.1, build: .95 },
    drought: { wood: .85, stone: 1, food: .6, build: 1 }, storm: { wood: .55, stone: .8, food: .65, build: .6 },
    frost: { wood: .7, stone: .9, food: .5, build: .8 },
  };
  const factors = {
    wood: p.moisture * (season === 'winter' ? .85 : 1) * (daylight ? 1 : .9),
    stone: (1 + (p.gravity - 1) * .3) * (daylight ? 1 : .95),
    food: p.moisture * seasonalFood * (daylight ? 1 : .85),
    build: 1 / p.gravity * (daylight ? 1 : .95),
  };
  const magicWind = .7 + generators[world.generatorVersion].sample(world.seed, day + 40_000) * .6;
  return { ...p, magicWind, magic: p.arcane * magicWind, day: day % p.orbitDays + 1, year: Math.floor(day / p.orbitDays) + 1, season, weather, daylight, factors, weatherFactors: weatherFactors[weather], nextBoundary: (phase + 1) * p.rotation / 2 - world.age };
}
export function speciesTraits(branch: Branch, sp: Species) {
  return { magic: sp === 'mineral' ? .35 : branch === 'symbiosis' ? 1.15 : branch === 'forest' ? 1.1 : 1, vitality: sp === 'mineral' ? .5 : 1 };
}
export function speciesAptitude(world: World, branch: Branch, sp: Species, job: Job): number {
  const base = aptitude(branch, sp, job);
  if (!base) return 0;
  const bias = (generators[world.generatorVersion].sample(world.seed, sp === 'base' ? 10 : 11) - .5) * .2;
  const variant = job === 'wood' || job === 'stone' ? 1 + bias : job === 'food' || job === 'build' ? 1 - bias : 1;
  return base * variant;
}
export function productionFactor(world: World, sp: Species, job: Job, weatherProtection = 0): number {
  if (job === 'craft' || job === 'research') return 1;
  const env = environment(world);
  const weather = env.weatherFactors[job];
  const resilience = sp === 'mineral' ? .6 : 1;
  return env.factors[job] * (weather < 1 ? 1 - (1 - weather) * resilience * (1 - weatherProtection) : weather);
}
