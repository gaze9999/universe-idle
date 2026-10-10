const buildingIds = ['habitat', 'lumberyard', 'warehouse', 'laboratory', 'workshop', 'monument', 'expansion1', 'expansion2', 'camp', 'mineralHabitat', 'grove', 'quarry', 'resonator'];
const technologyIds = ['crafting', 'planning', 'forestry', 'cultivation', 'mineralogy', 'arcana', 'vitality'];
const civilizationIds = ['nativehumanoid', 'nativecarapace', 'nativecrystalline', 'nativemycelial', 'developmentsettlements', 'developmentcityStates', 'developmentindustrial'];
const resources = ['wood', 'stone', 'food', 'planks', 'knowledge'];
const specialIds = ['monument', 'expansion1', 'expansion2', 'mineralHabitat'];
const starGodIds = ['grove', 'peak', 'harvest', 'foundation', 'craft', 'insight', 'frontier', 'earth', 'forge', 'discovery', 'harmony', 'creation'];
const catalogGroups = {
  buildings: buildingIds, technologies: technologyIds, civilizations: civilizationIds,
  resources, playerSpecies: ['base', 'mineral'], jobs: ['wood', 'stone', 'food', 'build', 'craft', 'research'],
  branches: ['forest', 'symbiosis'], achievements: ['settlement', 'diversity', 'scholar', 'legacy', 'endurance'],
  regions: ['home', 'upland', 'coast'], universes: ['standard', 'dense', 'volatile'],
  seasons: ['spring', 'summer', 'autumn', 'winter'], weather: ['clear', 'rain', 'drought', 'storm', 'frost'],
  starGods: starGodIds,
};
function labelKeys(group, id) {
  if (['buildings', 'technologies', 'branches'].includes(group)) return { name: id, description: id + 'Desc' };
  if (group === 'playerSpecies') return { name: id, description: id + 'Upkeep' };
  if (group === 'achievements') return { name: 'achievement' + id, description: 'achievement' + id + 'Desc', bonus: 'bonus' + id };
  if (group === 'starGods') return { name: 'starGod' + id, description: 'starGod' + id + 'Desc' };
  const prefix = { jobs: 'work', regions: 'region', universes: 'universe' }[group] ?? '';
  return { name: prefix + id };
}
const textIds = Object.entries(catalogGroups).flatMap(([group, ids]) => ids.flatMap(id => Object.values(labelKeys(group, id))));
const fail = message => { throw new Error(message); };
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}: 必須是物件`);
  return value;
}
function keys(value, allowed, label, exact = false) {
  object(value, label);
  if (Object.keys(value).some(key => !allowed.includes(key)) || exact && allowed.some(key => !Object.hasOwn(value, key))) fail(`${label}: 欄位不符合公開格式`);
}
function number(value, label, positive = false) {
  if (!Number.isFinite(value) || value < (positive ? Number.MIN_VALUE : 0) || value > Number.MAX_SAFE_INTEGER) fail(`${label}: 數值不合法`);
}
function conditions(value, label) {
  keys(value, ['branch', 'mineral', 'moisture', 'arcane', 'vitality'], label);
  for (const [key, amount] of Object.entries(value)) {
    if (key === 'branch') { if (!['base', 'forest', 'symbiosis'].includes(amount)) fail(`${label}: 物種型態不合法`); }
    else { number(amount, `${label}.${key}`); if (key === 'mineral' && !Number.isInteger(amount)) fail(`${label}: 物種數量必須是整數`); }
  }
}
function validateRuntime(value) {
  const required = ['schemaVersion', 'contentVersion', 'buildings', 'technologies', 'spawnCosts', 'starGods', 'texts'];
  keys(value, [...required, 'achievementSettings'], '遊戲資料');
  if (required.some(key => !Object.hasOwn(value, key))) fail('遊戲資料: 缺少必要欄位');
  if (value.achievementSettings !== undefined) {
    keys(value.achievementSettings, catalogGroups.achievements, '成就設定', true);
    for (const [id, setting] of Object.entries(value.achievementSettings)) {
      keys(setting, ['hidden'], id, true);
      if (typeof setting.hidden !== 'boolean') fail(`${id}: 隱藏設定不合法`);
    }
  }
  if (value.schemaVersion !== 2 || value.contentVersion !== 'ground-v0.3') fail('不支援此內容版本, 請先加入版本與遷移');
  keys(value.buildings, buildingIds, '建築', true); keys(value.technologies, technologyIds, '科技', true); keys(value.texts, textIds, '文案', true);
  keys(value.spawnCosts, catalogGroups.playerSpecies, '物種生成成本', true);
  keys(value.starGods, starGodIds, '星神', true);
  for (const [id, bonuses] of Object.entries(value.starGods)) {
    keys(bonuses, catalogGroups.jobs, `${id}.bonuses`);
    if (!Object.keys(bonuses).length) fail(`${id}: 星神必須提供本輪加成`);
    for (const amount of Object.values(bonuses)) { number(amount, `${id}.bonuses`); if (amount > 1) fail(`${id}: 工作加成不得超過 100%`); }
  }
  for (const [id, cost] of Object.entries(value.spawnCosts)) { keys(cost, resources, `${id}.spawnCost`); for (const amount of Object.values(cost)) number(amount, `${id}.spawnCost`); }
  const definitions = { ...value.buildings, ...value.technologies };
  for (const id of buildingIds) {
    const row = value.buildings[id]; keys(row, ['cost', 'work', 'requires', 'limit'], id, true);
    keys(row.cost, resources, `${id}.cost`); for (const amount of Object.values(row.cost)) number(amount, `${id}.cost`);
    number(row.work, `${id}.work`, true);
    if (specialIds.includes(id) ? row.limit !== 1 : row.limit !== null) fail(`${id}: 現行規則只有特殊建築限一座`);
    if (row.requires !== null && !Object.hasOwn(definitions, row.requires)) fail(`${id}: 前置條件不存在`);
  }
  for (const id of technologyIds) {
    const row = value.technologies[id]; keys(row, ['cost', 'requires', 'conditions'], id, true); number(row.cost, `${id}.cost`);
    if (!Object.hasOwn(definitions, row.requires)) fail(`${id}: 前置條件不存在`);
    conditions(row.conditions, `${id}.conditions`);
  }
  const visiting = new Set(); const complete = new Set();
  function visit(id) {
    if (visiting.has(id)) fail(`${id}: 前置條件形成循環`);
    if (complete.has(id)) return;
    visiting.add(id); const next = definitions[id].requires; if (next !== null) visit(next);
    // All research also requires a laboratory in Core, even when its explicit prerequisite differs.
    if (technologyIds.includes(id)) visit('laboratory');
    visiting.delete(id); complete.add(id);
  }
  Object.keys(definitions).forEach(visit);
  for (const [key, pair] of Object.entries(value.texts)) if (!Array.isArray(pair) || pair.length !== 3 || pair.some(text => typeof text !== 'string' || !text.trim() || text.length > 2000)) fail(`${key}: 必須提供繁中、英文與日文公開文案`);
  return value;
}
module.exports = { buildingIds, technologyIds, civilizationIds, catalogGroups, labelKeys, validateRuntime };
