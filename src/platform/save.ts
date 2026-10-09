import { achievementIds, aptitude, branches, contentVersion, jobs, queueLimit, researchDefs, researchIds, resources, species, structures } from '../core/content';
import type { Assignments, Branch, Job, Research, Resource, Structure, TaskId } from '../core/content';
import { assigned, buildingUnlocked, capacity, checkAchievements, count, has, meets, ordered, populationCapacity, slots, taskDef } from '../core/game';
import type { GameState } from '../core/game';
import { initialWorld, universes } from '../core/world';
import { bankLimit, defaultTimeBank } from '../core/time-bank';
import type { TimeBank } from '../core/time-bank';

export const saveKey = 'universe-idle/save-v1';
export const backupKey = 'universe-idle/backup-v1';
export const migrationKey = 'universe-idle/pre-upgrade-v3';
export const bankMigrationKey = 'universe-idle/pre-time-bank-v4';
export interface Preferences { language: 'zh-TW' | 'en'; paused: boolean; showCompleted: boolean }
export interface Save { format: 'universe-idle'; version: 4; lastAt: number; state: GameState; preferences: Preferences; timeBank: TimeBank }
export const defaultPreferences: Preferences = { language: 'zh-TW', paused: false, showCompleted: false };
const fail = (): never => { throw new Error('invalidSave'); };
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail();
}
function num(value: unknown, max = 1e12, integer = false): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max && (!integer || Number.isInteger(value)) ? value : fail();
}
function bool(value: unknown): boolean { return typeof value === 'boolean' ? value : fail(); }
function id<T extends string>(value: unknown, list: readonly T[]): T { return list.find(item => item === value) ?? fail(); }
function ids<T extends string>(value: unknown, list: readonly T[]): T[] {
  if (!Array.isArray(value) || value.length > list.length) return fail();
  const result = value.map(v => id(v, list));
  return new Set(result).size === result.length ? result : fail();
}
function amounts(value: unknown): Record<Resource, number> {
  const raw = record(value);
  return { wood: num(raw.wood), stone: num(raw.stone), food: num(raw.food), planks: num(raw.planks), knowledge: num(raw.knowledge) };
}
function work(value: unknown): Record<Job, number> {
  const raw = record(value);
  return { wood: num(raw.wood, Number.MAX_SAFE_INTEGER, true), stone: num(raw.stone, Number.MAX_SAFE_INTEGER, true), food: num(raw.food, Number.MAX_SAFE_INTEGER, true), build: num(raw.build, Number.MAX_SAFE_INTEGER, true), craft: num(raw.craft, Number.MAX_SAFE_INTEGER, true), research: num(raw.research, Number.MAX_SAFE_INTEGER, true) };
}
function assignments(value: unknown): Assignments {
  const raw = record(value);
  const result = { base: work(raw.base), mineral: work(raw.mineral) };
  if (jobs.some(j => result.mineral[j] > 0 && !aptitude('base', 'mineral', j))) return fail();
  if (species.some(sp => !Number.isSafeInteger(jobs.reduce((n, j) => n + result[sp][j], 0)))) return fail();
  return result;
}
const structureIds = Object.keys(structures) as Structure[];
const taskIds: TaskId[] = [...structureIds, 'recruit'];
const logKeys = ['arrival', 'started', 'built', 'cancelled', 'evolved', 'researched', 'purchased', 'resetDone', 'spawned', 'achievementUnlocked', 'queued', 'queueRemoved'];
const logItems = [...taskIds, ...branches, 'mineral', ...researchIds, 'tools', 'startChoice', 'templates', ...achievementIds.map(a => `achievement${a}`)];

/** 外部 JSON 逐欄驗證後建立白名單物件; 未知版本與不合法引用均拒絕, 不猜測或覆寫 */
export function parseSave(text: string): Save {
  if (text.length > 100_000) return fail();
  const raw = record(JSON.parse(text));
  if (raw.format !== 'universe-idle' || typeof raw.version !== 'number' || !Number.isInteger(raw.version)) return fail();
  if (![1, 2, 3, 4].includes(raw.version)) throw new Error('unsupportedSave');
  const data = record(raw.state);
  const old = raw.version === 1 && data.schemaVersion === 1 && data.contentVersion === 'ground-v0.1';
  const v2 = raw.version === 2 && data.schemaVersion === 2 && data.contentVersion === 'ground-v0.2';
  const previous = old || v2;
  if (!previous && (![3, 4].includes(raw.version as number) || data.schemaVersion !== 3 || data.contentVersion !== contentVersion)) throw new Error('unsupportedSave');
  const pop = record(data.population);
  const legacy = record(data.legacy);
  const prefs = record(raw.preferences);
  const task = data.task === null ? null : record(data.task);
  const logs = data.log;
  if (!Array.isArray(logs) || logs.length > 80) return fail();
  const world = old ? null : record(data.world);
  if (world && world.generatorVersion !== 1) throw new Error('unsupportedSave');
  const achievements = old ? {} : record(data.achievements);
  const stats = old ? null : record(data.stats);
  const buildings = previous ? ids(data.buildings, structureIds) : Array.isArray(data.buildings) ? data.buildings.map(value => id(value, structureIds)) : fail();
  const taskId = task ? id(task.id, taskIds) : null;
  const queue = previous ? [] : Array.isArray(data.queue) && data.queue.length <= queueLimit ? data.queue.map(value => id(value, structureIds)) : fail();
  const taskCost = task && !previous ? record(task.cost) : null;
  if (taskCost && Object.keys(taskCost).some(r => !resources.includes(r as Resource))) return fail();
  const state: GameState = {
    schemaVersion: 3, contentVersion,
    resources: amounts(data.resources), refund: amounts(data.refund),
    population: { base: num(pop.base, previous ? 8 : Number.MAX_SAFE_INTEGER, true), mineral: num(pop.mineral, previous ? 4 : Number.MAX_SAFE_INTEGER, true) },
    assignments: assignments(data.assignments),
    branch: id<Branch>(data.branch, branches), buildings, research: ids<Research>(data.research, previous ? ['crafting', 'planning'] : researchIds),
    task: task && taskId ? { id: taskId, progress: num(task.progress, Number.MAX_VALUE), paused: bool(task.paused), ...(previous ? taskDef(taskId) : { cost: Object.fromEntries(Object.entries(taskCost!).map(([r, amount]) => [r, num(amount, Number.MAX_VALUE)])), work: num(task.work, Number.MAX_VALUE) }) } : null,
    queue, queuePaused: previous ? false : bool(data.queuePaused),
    elapsed: num(data.elapsed),
    world: world ? { seed: num(world.seed, 4294967295, true), generatorVersion: 1, universe: id(world.universe, universes), age: num(world.age) } : { ...initialWorld(), age: num(data.elapsed) },
    achievements: Object.fromEntries(achievementIds.filter(a => achievements[a] !== undefined).map(a => [a, previous ? (num(achievements[a]), null) : achievements[a] === null ? null : num(achievements[a], 1e15, true)])),
    stats: { severeSeconds: stats ? num(stats.severeSeconds) : 0 },
    legacy: { points: num(legacy.points, 1e9, true), resets: num(legacy.resets, 1e8, true), tools: num(legacy.tools, 5, true), startChoice: bool(legacy.startChoice), templates: bool(legacy.templates), discovered: ids(legacy.discovered, branches) },
    template: data.template === null ? null : assignments(data.template),
    log: logs.map(value => { const entry = record(value); return { at: num(entry.at), key: id(entry.key, logKeys), ...(entry.item === undefined ? {} : { item: id(entry.item, logItems) }) }; }),
  };
  if (state.population.base < 6 || state.population.base > populationCapacity(state, 'base') || state.population.mineral > populationCapacity(state, 'mineral')) return fail();
  if (old && state.population.mineral !== populationCapacity(state, 'mineral')) return fail();
  if (state.world.age + 1e-7 < state.elapsed || state.stats.severeSeconds > state.world.age + 1e-7) return fail();
  if (previous && Object.values(achievements).some(at => num(at) > state.world.age)) return fail();
  if (!state.legacy.discovered.includes('base') || !state.legacy.discovered.includes(state.branch)) return fail();
  if (state.branch !== 'base' && !has(state, 'habitat') && !state.legacy.startChoice) return fail();
  for (const sp of species) if (assigned(state, sp) > state.population[sp]) return fail();
  for (const job of jobs) if (species.reduce((n, sp) => n + state.assignments[sp][job], 0) > slots(state, job)) return fail();
  for (const r of resources) if (state.resources[r] > capacity(state) + 1e-7) return fail();
  if (!has(state, 'workshop') && state.resources.planks !== 0 || !has(state, 'laboratory') && state.resources.knowledge !== 0) return fail();
  for (const b of structureIds) {
    const limit = structures[b].limit;
    if (limit !== null && ordered(state, b) > limit || count(state, b) && !buildingUnlocked(state, b)) return fail();
  }
  for (const b of state.queue) if (!buildingUnlocked(state, b) || b === 'mineralHabitat') return fail();
  for (const r of state.research) if (!has(state, 'laboratory') || !has(state, researchDefs[r].requires) || !meets(state, researchDefs[r].conditions)) return fail();
  if (state.task) {
    const def = taskDef(state.task.id, state.task.id === 'recruit' ? 0 : count(state, state.task.id));
    if (state.task.progress > state.task.work + 1e-7 || state.task.work !== def.work || resources.some(r => (state.task!.cost[r] ?? 0) !== (def.cost[r] ?? 0))) return fail();
    const required = state.task.id === 'recruit' ? 'camp' : structures[state.task.id].requires;
    if (required && !has(state, required) || state.task.id === 'recruit' && state.population.base >= populationCapacity(state, 'base') || state.task.id !== 'recruit' && !buildingUnlocked(state, state.task.id)) return fail();
  }
  if (previous) {
    if (jobs.some(j => state.assignments.base[j] + state.assignments.mineral[j] > (j === 'craft' ? 1 : j === 'research' ? 2 : 12))) return fail();
    if (state.template && (species.some(sp => jobs.reduce((n, j) => n + state.template![sp][j], 0) > (sp === 'base' ? 8 : 4)) || jobs.some(j => state.template!.base[j] + state.template!.mineral[j] > (j === 'craft' ? 1 : j === 'research' ? 2 : 12)))) return fail();
    if (state.task && state.task.id !== 'recruit' && has(state, state.task.id)) return fail();
  }
  const language = id(prefs.language, ['zh-TW', 'en'] as const);
  if (previous) checkAchievements(state);
  const bank = raw.version === 4 ? record(raw.timeBank) : null;
  const timeBank = bank ? { seconds: num(bank.seconds, bankLimit), enabled: bool(bank.enabled) } : defaultTimeBank();
  timeBank.enabled = true;
  return { format: 'universe-idle', version: 4, lastAt: num(raw.lastAt, 1e15, true), state, preferences: { language, paused: bool(prefs.paused), showCompleted: old ? false : bool(prefs.showCompleted) }, timeBank };
}
export function encodeSave(state: GameState, preferences: Preferences, lastAt: number, timeBank = defaultTimeBank()): string {
  return JSON.stringify({ format: 'universe-idle', version: 4, lastAt, state, preferences, timeBank } satisfies Save);
}
export function writeSave(storage: Storage, text: string): void {
  let previous: string | null = null;
  let parsed: Save | null = null;
  for (const key of [saveKey, backupKey]) {
    const candidate = storage.getItem(key);
    if (!candidate) continue;
    try { parsed = parseSave(candidate); previous = candidate; break; }
    catch (error) { if (!(error instanceof SyntaxError) && error instanceof Error && !['invalidSave', 'unsupportedSave'].includes(error.message)) throw error; }
  }
  if (previous && parsed) {
    const version = JSON.parse(previous).version;
    const old = version !== 4;
    const protection = version < 3 ? migrationKey : bankMigrationKey;
    if (old && !storage.getItem(protection)) storage.setItem(protection, previous);
    storage.setItem(backupKey, old ? encodeSave(parsed.state, parsed.preferences, parsed.lastAt, parsed.timeBank) : previous);
  }
  storage.setItem(saveKey, text);
}
export function readSave(storage: Storage): { save: Save | null; notice: string | null; blocked: boolean } {
  const text = storage.getItem(saveKey);
  if (!text) return { save: null, notice: null, blocked: false };
  try { return { save: parseSave(text), notice: null, blocked: false }; }
  catch (error) {
    if (error instanceof Error && error.message === 'unsupportedSave') return { save: null, notice: 'unsupportedSave', blocked: true };
    const backup = storage.getItem(backupKey);
    if (backup) try { return { save: parseSave(backup), notice: 'backupRecovered', blocked: false }; } catch { /* 保留損毀原檔, 等待有效匯入 */ }
    return { save: null, notice: 'damagedSave', blocked: true };
  }
}
