import { generatePlanet, sample } from './v1';
import { generateCivilization } from './civilization-v1';

/** 已發布生成演算法保留, 新演算法新增版本入口, 舊世界沿原版本推導 */
export const generators = { 1: { planet: generatePlanet, civilization: generateCivilization, sample } } as const;
