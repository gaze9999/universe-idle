import gameData from '../../content/game-data.json';
export const resources = ['wood', 'stone', 'food', 'planks', 'knowledge'] as const;
export const jobs = ['wood', 'stone', 'food', 'build', 'craft', 'research'] as const;
export const species = ['base', 'mineral'] as const;
export const branches = ['base', 'forest', 'symbiosis'] as const;
export const researchIds = ['crafting', 'planning', 'forestry', 'cultivation', 'mineralogy', 'arcana', 'vitality'] as const;
export type Resource = typeof resources[number];
export type Job = typeof jobs[number];
export type Species = typeof species[number];
export type Branch = typeof branches[number];
export type Research = typeof researchIds[number];
export type Cost = Partial<Record<Resource, number>>;
export type Assignments = Record<Species, Record<Job, number>>;
export const starGodIds = ['grove', 'peak', 'harvest', 'foundation', 'craft', 'insight', 'frontier', 'earth', 'forge', 'discovery', 'harmony', 'creation'] as const;
export type StarGod = typeof starGodIds[number];
/** 星神工作加成為比例, .1 表示 +10%, 只作用於選定星神的本輪 */
export const starGodDefs: Record<StarGod, Partial<Record<Job, number>>> = gameData.starGods;

/** 地面內容; cost 為首座材料, work 為首座工作量, limit 只限制特殊建築, null 為無上限 */
export const structureIds = ['habitat', 'lumberyard', 'warehouse', 'laboratory', 'workshop', 'monument', 'expansion1', 'expansion2', 'camp', 'mineralHabitat', 'grove', 'quarry', 'resonator'] as const;
export type Structure = typeof structureIds[number];
export const structures: Record<Structure, { cost: Cost; work: number; requires: string | null; limit: number | null }> = gameData.buildings;
export type TaskId = Structure | 'recruit';
/** 科技同時檢查設施, 前置研究, 物種型態與固定星球屬性; 天氣不會反覆鎖定科技 */
export interface Conditions { branch?: Branch; mineral?: number; moisture?: number; arcane?: number; vitality?: number }
// 公開資料在 check-content 與 pipeline 驗證 Conditions 的列舉與數值, JSON 字串在此對應型別
export const researchDefs = gameData.technologies as Record<Research, { cost: number; requires: string; conditions: Conditions }>;
export const researchCosts = Object.fromEntries(researchIds.map(id => [id, researchDefs[id].cost])) as Record<Research, number>;
export const buildingConditions: Partial<Record<Structure, Conditions>> = { grove: { branch: 'forest', moisture: 1 }, quarry: { mineral: 1 }, resonator: { arcane: .45 } };
/** 最大佇列容量; 存檔仍接受舊版最多 12 個等候項目, 不截斷既有進度 */
export const queueLimit = 12;
export const recruit = { cost: { wood: 30, food: 20 }, work: 30 };
export const spawnCosts: Record<Species, Cost> = gameData.spawnCosts;
export const achievementIds = ['settlement', 'diversity', 'scholar', 'legacy', 'endurance'] as const;
export type Achievement = typeof achievementIds[number];
export const achievementSettings: Record<Achievement, { hidden: boolean }> = gameData.achievementSettings ?? { settlement: { hidden: false }, diversity: { hidden: false }, scholar: { hidden: false }, legacy: { hidden: false }, endurance: { hidden: true } };
export const contentVersion = 'ground-v0.3';
export const emptyResources = (): Record<Resource, number> => ({ wood: 0, stone: 0, food: 0, planks: 0, knowledge: 0 });
export const emptyJobs = (): Record<Job, number> => ({ wood: 0, stone: 0, food: 0, build: 0, craft: 0, research: 0 });

export function aptitude(branch: Branch, sp: Species, job: Job): number {
  if (sp === 'mineral') return job === 'stone' || job === 'build' ? 1.5 : job === 'wood' ? 1 : 0;
  return branch === 'forest' && job === 'wood' || branch === 'symbiosis' && job === 'food' ? 1.5 : 1;
}
