import { aptitude, buildingConditions, contentVersion, emptyJobs, emptyResources, jobs, queueLimit, recruit, researchDefs, resources, spawnCosts, species, structures } from './content';
import type { Achievement, Assignments, Branch, Conditions, Cost, Job, Research, Resource, Species, Structure, TaskId } from './content';
import { environment, initialWorld, planet, productionFactor, speciesAptitude, speciesTraits } from './world';
import type { World } from './world';

/** elapsed 為本輪秒數; world 跨輪保留; achievements 保存首次達成的 Unix 毫秒, null 為舊檔未記錄日期
 * buildings 每筆代表一座; task 保存開工時的材料與工作量; queue 為未消耗材料的順序佇列
 * stats.severeSeconds 累計惡劣天氣工作秒數; resources/refund 保留小數, log 最多 80 筆 */
export interface GameState {
  schemaVersion: 3;
  contentVersion: string;
  resources: Record<Resource, number>;
  refund: Record<Resource, number>;
  population: Record<Species, number>;
  assignments: Assignments;
  branch: Branch;
  buildings: Structure[];
  research: Research[];
  task: { id: TaskId; progress: number; paused: boolean; cost: Cost; work: number } | null;
  queue: Structure[];
  queuePaused: boolean;
  elapsed: number;
  world: World;
  achievements: Partial<Record<Achievement, number | null>>;
  stats: { severeSeconds: number };
  legacy: { points: number; resets: number; tools: number; startChoice: boolean; templates: boolean; discovered: Branch[] };
  template: Assignments | null;
  log: { at: number; key: string; item?: string }[];
}
export type Command =
  | { type: 'assign'; sp: Species; job: Job; delta: number }
  | { type: 'spawn'; sp: Species }
  | { type: 'build'; id: TaskId }
  | { type: 'pauseBuild' }
  | { type: 'cancelBuild' }
  | { type: 'removeQueued'; index: number }
  | { type: 'moveQueued'; index: number; delta: -1 | 1 }
  | { type: 'reorderQueued'; from: number; to: number }
  | { type: 'pauseQueue' }
  | { type: 'claimRefund' }
  | { type: 'branch'; id: Branch }
  | { type: 'research'; id: Research }
  | { type: 'reset'; start: Branch; abandon?: boolean }
  | { type: 'meta'; id: 'tools' | 'startChoice' | 'templates' }
  | { type: 'saveTemplate' | 'applyTemplate' };
const eps = 1e-8;
export const has = (s: GameState, id: string) => s.buildings.includes(id as Structure) || s.research.includes(id as Research);
export const count = (s: GameState, id: Structure) => s.buildings.filter(b => b === id).length;
export const ordered = (s: GameState, id: Structure) => count(s, id) + (s.task?.id === id ? 1 : 0) + s.queue.filter(b => b === id).length;
export function buildingLimitReached(s: GameState, id: Structure, includeQueued = false): boolean {
  const limit = structures[id].limit;
  return limit !== null && (includeQueued ? ordered(s, id) : count(s, id)) >= limit;
}
export const capacity = (s: GameState) => 200 + 800 * count(s, 'warehouse');
/** 佇列容量包含目前工程; 工坊與聚落規劃擴充, 舊檔超額項目保留至自然清空 */
export const queueCapacity = (s: GameState) => Math.min(queueLimit, 2 + count(s, 'workshop') + (has(s, 'planning') ? 2 : 0));
export const assigned = (s: GameState, sp: Species) => jobs.reduce((n, j) => n + s.assignments[sp][j], 0);
export const idle = (s: GameState, sp: Species) => s.population[sp] - assigned(s, sp);
export const populationCapacity = (s: GameState, sp: Species) => sp === 'base' ? 6 + 2 * count(s, 'camp') : 2 * (count(s, 'habitat') + count(s, 'mineralHabitat'));
export const reward = (s: GameState) => has(s, 'monument') ? 10 + (has(s, 'expansion1') ? 5 : 0) + (has(s, 'expansion2') ? 5 : 0) : 0;
export function taskDef(id: TaskId, n = 0): { cost: Cost; work: number } {
  const def = id === 'recruit' ? recruit : structures[id];
  return { cost: Object.fromEntries(Object.entries(def.cost).map(([r, amount]) => [r, Math.ceil(amount * 1.25 ** n)])), work: Math.ceil(def.work * 1.15 ** n) };
}
export const canAfford = (s: GameState, cost: Cost) => resources.every(r => s.resources[r] + eps >= (cost[r] ?? 0));
export const slots = (s: GameState, job: Job) => job === 'craft' ? count(s, 'workshop') : job === 'research' ? 2 * count(s, 'laboratory') : Infinity;
export const earned = (s: GameState, id: Achievement) => s.achievements[id] !== undefined;

export function meets(s: GameState, conditions: Conditions): boolean {
  const p = planet(s.world);
  return (!conditions.branch || s.branch === conditions.branch) && s.population.mineral >= (conditions.mineral ?? 0)
    && p.moisture >= (conditions.moisture ?? 0) && p.arcane >= (conditions.arcane ?? 0) && p.vitality >= (conditions.vitality ?? 0);
}
export function buildingUnlocked(s: GameState, id: Structure): boolean {
  const required = structures[id].requires;
  return (!required || has(s, required)) && meets(s, buildingConditions[id] ?? {});
}
export function researchReason(s: GameState, id: Research): string | null {
  if (s.research.includes(id)) return 'completed';
  const def = researchDefs[id];
  if (!has(s, 'laboratory') || !has(s, def.requires) || !meets(s, def.conditions) || !s.population.base) return 'locked';
  return s.resources.knowledge + eps < def.cost ? 'materials' : null;
}
export function queueReason(s: GameState, id: TaskId): string | null {
  if (id === 'recruit' || id === 'mineralHabitat' || !buildingUnlocked(s, id)) return 'locked';
  if (buildingLimitReached(s, id, true)) return structures[id].limit === 1 ? 'completed' : 'buildingLimit';
  return s.queue.length + (s.task ? 1 : 0) >= queueCapacity(s) ? 'queueFull' : null;
}

export function createGame(world: World = initialWorld()): GameState {
  return {
    schemaVersion: 3, contentVersion,
    resources: { ...emptyResources(), food: 30 }, refund: emptyResources(),
    population: { base: 6, mineral: 0 },
    assignments: { base: emptyJobs(), mineral: emptyJobs() },
    branch: 'base', buildings: [], research: [], task: null, queue: [], queuePaused: false, elapsed: 0, world: { ...world }, achievements: {}, stats: { severeSeconds: 0 },
    legacy: { points: 0, resets: 0, tools: 0, startChoice: false, templates: false, discovered: ['base'] },
    template: null, log: [{ at: 0, key: 'arrival' }],
  };
}
function event(s: GameState, key: string, item?: string): void {
  s.log.push({ at: s.elapsed, key, ...(item ? { item } : {}) });
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
}
export function checkAchievements(s: GameState, realAt: number | null = null): void {
  const checks: [Achievement, boolean][] = [['settlement', has(s, 'habitat')], ['diversity', s.population.mineral > 0], ['scholar', s.research.length > 0], ['legacy', s.legacy.resets > 0], ['endurance', s.stats.severeSeconds >= 300 - eps]];
  for (const [id, reached] of checks) if (reached && !earned(s, id)) { s.achievements[id] = realAt; event(s, 'achievementUnlocked', `achievement${id}`); }
}
export function spawnReason(s: GameState, sp: Species): string | null {
  if (populationCapacity(s, sp) === 0) return 'locked';
  if (s.population[sp] >= populationCapacity(s, sp) || sp === 'base' && s.task?.id === 'recruit' && s.population.base + 1 >= populationCapacity(s, sp)) return 'habitatFull';
  return canAfford(s, spawnCosts[sp]) ? null : 'materials';
}
export function buildReason(s: GameState, id: TaskId): string | null {
  const reason = queueReason(s, id);
  if (reason) return reason;
  if (s.task) return 'busy';
  return canAfford(s, taskDef(id, id === 'recruit' ? 0 : count(s, id)).cost) ? null : 'materials';
}
/** 只有隊首可開工; 成本按實際已完成座數計算, 取消或排序不留下預扣材料 */
function startQueued(s: GameState): void {
  if (s.task || s.queuePaused || !s.queue.length) return;
  const id = s.queue[0];
  if (!buildingUnlocked(s, id)) return;
  const def = taskDef(id, count(s, id));
  if (!canAfford(s, def.cost)) return;
  for (const r of resources) s.resources[r] = Math.max(0, s.resources[r] - (def.cost[r] ?? 0));
  s.queue.shift();
  s.task = { id, progress: 0, paused: false, ...def };
  event(s, 'started', id);
}

/** 即時生產投影與停工狀態由 Core 同一次計算, UI 不另計產率 */
export function flow(s: GameState) {
  const env = environment(s.world);
  const efficiency = (sp: Species, job: Job) => {
    const traits = speciesTraits(s.branch, sp);
    const physical = job !== 'research' && job !== 'craft';
    let bonus = physical ? 1 + env.vitality * .04 * traits.vitality : 1;
    if (physical && has(s, 'vitality')) bonus *= 1.08;
    if (job === 'wood') bonus *= (has(s, 'forestry') ? 1.1 : 1) * (1 + count(s, 'grove') * .05) * (earned(s, 'legacy') ? 1.02 : 1);
    if (job === 'stone') bonus *= (sp === 'mineral' && has(s, 'mineralogy') ? 1.15 : 1) * (sp === 'mineral' ? 1 + count(s, 'quarry') * .05 : 1) * (earned(s, 'diversity') ? 1.02 : 1) * (earned(s, 'legacy') ? 1.02 : 1);
    if (job === 'food') bonus *= (has(s, 'cultivation') ? 1.1 : 1) * (earned(s, 'legacy') ? 1.02 : 1);
    if (job === 'build') bonus *= earned(s, 'settlement') ? 1.02 : 1;
    if (job === 'research') bonus *= (earned(s, 'scholar') ? 1.03 : 1) * (1 + env.magic * traits.magic * ((has(s, 'arcana') ? .1 : 0) + count(s, 'resonator') * .02));
    return speciesAptitude(s.world, s.branch, sp, job) * productionFactor(s.world, sp, job, earned(s, 'endurance') ? .1 : 0) * bonus;
  };
  const foodProduction = s.assignments.base.food * .5 * efficiency('base', 'food');
  const foodDemand = s.population.base * .05;
  const starving = s.resources.food <= eps && foodProduction + eps < foodDemand;
  const morale = starving ? .5 : 1;
  const speed = (sp: Species, job: Job) => s.assignments[sp][job] * efficiency(sp, job) * (sp === 'base' && job !== 'food' ? morale : 1);
  let lumberSlots = 2 * count(s, 'lumberyard');
  let woodProduction = 0;
  for (const sp of species) {
    const boosted = Math.min(lumberSlots, s.assignments[sp].wood);
    lumberSlots -= boosted;
    woodProduction += (s.assignments[sp].wood + .2 * boosted) * .2 * efficiency(sp, 'wood') * (sp === 'base' ? morale : 1) * (1 + s.legacy.tools * .05);
  }
  const desiredPlanks = Math.min(slots(s, 'craft'), s.assignments.base.craft) * .05 * morale;
  let plankProduction = s.resources.planks >= capacity(s) - eps ? 0 : desiredPlanks;
  if (s.resources.wood <= eps) plankProduction = Math.min(plankProduction, woodProduction / 5);
  const raw: Record<Resource, number> = {
    wood: woodProduction - plankProduction * 5,
    stone: species.reduce((n, sp) => n + speed(sp, 'stone') * .15, 0) * (1 + s.legacy.tools * .05),
    food: foodProduction - foodDemand,
    knowledge: speed('base', 'research') * .25,
    planks: plankProduction,
  };
  const rates = { ...raw };
  for (const r of resources) if (s.resources[r] >= capacity(s) - eps && rates[r] > 0 || s.resources[r] <= eps && rates[r] < 0) rates[r] = 0;
  const buildSpeed = species.reduce((n, sp) => n + speed(sp, 'build'), 0);
  const displayRates = { ...raw, planks: s.resources.wood <= eps ? Math.min(desiredPlanks, woodProduction / 5) : desiredPlanks };
  return { rates, raw, displayRates, starving, foodProduction, foodDemand, plankProduction, desiredPlanks, constructionSpeed: buildSpeed, buildSpeed: s.task && !s.task.paused ? buildSpeed : 0 };
}
function complete(s: GameState, realAt: number | null): void {
  if (!s.task) return;
  const { id } = s.task;
  s.task = null;
  if (id === 'recruit') s.population.base++;
  else {
    s.buildings.push(id);
  }
  event(s, 'built', id);
  if (s.legacy.templates && s.template) fillTemplate(s);
  checkAchievements(s, realAt);
}
function fillTemplate(s: GameState): void {
  if (!s.template) return;
  for (const sp of species) for (const job of jobs) {
    const count = Math.min(Math.max(0, s.template[sp][job] - s.assignments[sp][job]), idle(s, sp), slots(s, job) - species.reduce((n, p) => n + s.assignments[p][job], 0));
    if (aptitude(s.branch, sp, job)) s.assignments[sp][job] += Math.max(0, count);
  }
}

/** 依事件邊界積分; seconds 為世界秒數, realSeconds 為對應現實秒數, 用於加速時映射成就日期 */
export function advance(s: GameState, seconds: number, realStart: number | null = null, realSeconds = seconds): void {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(realSeconds) || realSeconds < 0) throw new Error('invalidTime');
  let remaining = seconds;
  let iterations = 0;
  const realAt = () => realStart === null ? null : Math.round(realStart + (seconds > 0 ? (seconds - remaining) / seconds * realSeconds : 0) * 1000);
  while (remaining > eps) {
    startQueued(s);
    if (++iterations > 4096) throw new Error('simulationLimit');
    const env = environment(s.world);
    const severeWork = ['storm', 'frost'].includes(env.weather) && species.some(sp => assigned(s, sp) > 0);
    const { rates, buildSpeed } = flow(s);
    let dt = Math.min(remaining, env.nextBoundary);
    if (severeWork && s.stats.severeSeconds < 300 - eps) dt = Math.min(dt, 300 - s.stats.severeSeconds);
    for (const r of resources) {
      if (rates[r] > eps && s.resources[r] < capacity(s) - eps) dt = Math.min(dt, (capacity(s) - s.resources[r]) / rates[r]);
      if (rates[r] < -eps && s.resources[r] > eps) dt = Math.min(dt, -s.resources[r] / rates[r]);
    }
    if (!s.task && !s.queuePaused && s.queue.length && buildingUnlocked(s, s.queue[0])) {
      const cost = taskDef(s.queue[0], count(s, s.queue[0])).cost;
      let wait = 0;
      for (const r of resources) if (s.resources[r] + eps < (cost[r] ?? 0)) wait = Math.max(wait, rates[r] > eps && (cost[r] ?? 0) <= capacity(s) ? ((cost[r] ?? 0) - s.resources[r]) / rates[r] : Infinity);
      if (wait > eps) dt = Math.min(dt, wait);
    }
    if (s.task && buildSpeed > eps) dt = Math.min(dt, Math.max(0, s.task.work - s.task.progress) / buildSpeed);
    if (dt <= eps) {
      if (s.task && s.task.progress + eps >= s.task.work) { complete(s, realAt()); continue; }
      throw new Error('simulationBoundary');
    }
    for (const r of resources) {
      const amount = Math.min(capacity(s), Math.max(0, s.resources[r] + rates[r] * dt));
      s.resources[r] = amount < eps ? 0 : capacity(s) - amount < eps ? capacity(s) : amount;
    }
    if (s.task) s.task.progress += buildSpeed * dt;
    s.elapsed += dt;
    s.world.age += dt;
    if (severeWork) s.stats.severeSeconds += dt;
    remaining -= dt;
    if (s.task && s.task.progress + eps >= s.task.work) complete(s, realAt());
    checkAchievements(s, realAt());
    startQueued(s);
  }
  checkAchievements(s, realAt());
}
export function execute(s: GameState, cmd: Command, realAt: number | null = null): string | null {
  switch (cmd.type) {
    case 'spawn': {
      const reason = spawnReason(s, cmd.sp);
      if (reason) return reason;
      for (const r of resources) s.resources[r] = Math.max(0, s.resources[r] - (spawnCosts[cmd.sp][r] ?? 0));
      s.population[cmd.sp]++;
      event(s, 'spawned', cmd.sp === 'base' ? s.branch : cmd.sp);
      if (s.legacy.templates && s.template) fillTemplate(s);
      checkAchievements(s, realAt);
      return null;
    }
    case 'assign': {
      const { sp, job, delta } = cmd;
      if (!Number.isInteger(delta) || delta === 0) return 'invalidAssignment';
      if (!aptitude(s.branch, sp, job)) return 'unsupported';
      if (s.assignments[sp][job] + delta < 0 || delta > idle(s, sp)) return 'workers';
      if (delta > 0 && species.reduce((n, p) => n + s.assignments[p][job], 0) + delta > slots(s, job)) return 'slotsFull';
      s.assignments[sp][job] += delta;
      return null;
    }
    case 'build': {
      const reason = queueReason(s, cmd.id);
      if (reason) return reason;
      if (cmd.id === 'recruit') return 'locked';
      s.queue.push(cmd.id);
      event(s, 'queued', cmd.id);
      startQueued(s);
      return null;
    }
    case 'pauseQueue': s.queuePaused = !s.queuePaused; startQueued(s); return null;
    case 'reorderQueued': {
      const { from, to } = cmd;
      if (![from, to].every(index => Number.isInteger(index) && index >= 0 && index < s.queue.length)) return 'invalidQueue';
      const [id] = s.queue.splice(from, 1);
      s.queue.splice(to, 0, id);
      startQueued(s);
      return null;
    }
    case 'removeQueued':
    case 'moveQueued': {
      const { index } = cmd;
      if (!Number.isInteger(index) || index < 0 || index >= s.queue.length) return 'invalidQueue';
      if (cmd.type === 'removeQueued') { const [id] = s.queue.splice(index, 1); event(s, 'queueRemoved', id); }
      else { const next = index + cmd.delta; if (next < 0 || next >= s.queue.length) return 'invalidQueue'; [s.queue[index], s.queue[next]] = [s.queue[next], s.queue[index]]; }
      startQueued(s);
      return null;
    }
    case 'pauseBuild': if (s.task) s.task.paused = !s.task.paused; return null;
    case 'cancelBuild': {
      if (!s.task) return 'noTask';
      const { cost } = s.task;
      for (const r of resources) {
        const refund = cost[r] ?? 0;
        const received = Math.min(refund, capacity(s) - s.resources[r]);
        s.resources[r] += received;
        s.refund[r] += refund - received;
      }
      event(s, 'cancelled', s.task.id);
      s.task = null;
      startQueued(s);
      return null;
    }
    case 'claimRefund':
      for (const r of resources) { const received = Math.min(s.refund[r], capacity(s) - s.resources[r]); s.resources[r] += received; s.refund[r] -= received; }
      return null;
    case 'branch':
      if (!has(s, 'habitat') || s.branch !== 'base' || cmd.id === 'base') return 'locked';
      s.branch = cmd.id;
      if (!s.legacy.discovered.includes(cmd.id)) s.legacy.discovered.push(cmd.id);
      event(s, 'evolved', cmd.id);
      return null;
    case 'research': {
      const reason = researchReason(s, cmd.id);
      if (reason) return reason;
      s.resources.knowledge = Math.max(0, s.resources.knowledge - researchDefs[cmd.id].cost);
      s.research.push(cmd.id);
      event(s, 'researched', cmd.id);
      checkAchievements(s, realAt);
      return null;
    }
    case 'meta': {
      const cost = cmd.id === 'tools' ? 20 * 2 ** s.legacy.tools : 10;
      if (cmd.id === 'tools' ? s.legacy.tools >= 5 : s.legacy[cmd.id]) return 'completed';
      if (s.legacy.points < cost) return 'legacyPoints';
      s.legacy.points -= cost;
      if (cmd.id === 'tools') s.legacy.tools++;
      else s.legacy[cmd.id] = true;
      event(s, 'purchased', cmd.id);
      return null;
    }
    case 'saveTemplate': if (!s.legacy.templates) return 'locked'; s.template = structuredClone(s.assignments); return null;
    case 'applyTemplate': {
      if (!s.legacy.templates || !s.template) return 'noTemplate';
      for (const sp of species) s.assignments[sp] = emptyJobs();
      fillTemplate(s);
      return null;
    }
    case 'reset': {
      const earned = cmd.abandon ? 0 : reward(s);
      if (!earned && !cmd.abandon) return 'locked';
      if (cmd.start !== 'base' && (!s.legacy.startChoice || !s.legacy.discovered.includes(cmd.start))) return 'locked';
      const next = createGame(s.world);
      next.legacy = structuredClone(s.legacy);
      next.legacy.points += earned;
      next.legacy.resets += earned ? 1 : 0;
      next.branch = cmd.start;
      next.template = structuredClone(s.template);
      next.achievements = { ...s.achievements };
      next.stats = { ...s.stats };
      next.log = [{ at: 0, key: earned ? 'resetDone' : 'arrival' }];
      Object.assign(s, next);
      checkAchievements(s, realAt);
      return null;
    }
  }
}
