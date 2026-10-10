import { achievementIds, achievementSettings, jobs, researchIds, resources, structures } from '../core/content';
import type { Structure } from '../core/content';
import { achievementProgress, buildingLimitReached, buildingUnlocked, earned, has, researchReason, slots } from '../core/game';
import type { GameState } from '../core/game';
export const recordCategories = ['all', 'construction', 'research', 'population', 'progress'] as const;
export type RecordCategory = typeof recordCategories[number];
export function recordCategory(key: string): RecordCategory {
  if (['started', 'built', 'cancelled', 'queued', 'queueRemoved'].includes(key)) return 'construction';
  if (key === 'researched') return 'research';
  if (['spawned', 'evolved'].includes(key)) return 'population';
  return 'progress';
}

export const tabIds = ['overview', 'species', 'workers', 'buildings', 'science', 'starGods', 'achievements', 'legacy'] as const;
export type Tab = typeof tabIds[number];
export const childTabs: Record<Tab, readonly string[]> = {
  overview: ['summary'], species: ['currentPlanet'], workers: ['currentPlanet'], buildings: ['currentPlanet'],
  science: ['availableResearch', 'completedResearch'], starGods: ['summary'], achievements: ['achievementList', 'permanentBonuses'], legacy: ['legacyOverview'],
};

/** 依已取得設施呈現玩家目前能使用的內容, 不因材料不足或正在建造而隱藏 */
export function project(state: GameState, showCompleted = false) {
  const tasks = Object.keys(structures) as Structure[];
  const science = has(state, 'laboratory');
  const legacy = has(state, 'monument') || state.legacy.resets > 0 || state.legacy.points > 0 || state.legacy.startChoice || state.legacy.templates || state.legacy.tools > 0;
  return {
    tabs: tabIds.filter(id => id === 'science' ? science : !['starGods', 'achievements', 'legacy'].includes(id)),
    mainTabs: ['planet', ...(!state.starGod ? ['starGods'] : []), 'achievements', ...(legacy ? ['legacy'] : [])],
    achievements: achievementIds.filter(id => !achievementSettings[id].hidden || earned(state, id)).sort((a, b) => achievementProgress(state, b) - achievementProgress(state, a)),
    resources: resources.filter(r => r === 'knowledge' ? science : r === 'planks' ? has(state, 'workshop') : true),
    jobs: jobs.filter(job => slots(state, job) > 0),
    tasks: tasks.filter(id => id === 'mineralHabitat' ? showCompleted && has(state, id) : (showCompleted || !buildingLimitReached(state, id)) && buildingUnlocked(state, id)),
    research: researchIds.filter(id => state.research.includes(id) || researchReason(state, id) !== 'locked'),
  };
}
