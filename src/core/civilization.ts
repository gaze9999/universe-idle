export const nativeArchetypes = ['humanoid', 'carapace', 'crystalline', 'mycelial'] as const;
export const developmentStages = ['settlements', 'cityStates', 'industrial'] as const;

/** 星球原生智慧物種與代表文明, 不等同玩家可派遣物種或當前聚落人口 */
export interface NativeCivilization {
  id: string;
  species: { id: string; archetype: typeof nativeArchetypes[number] };
  development: typeof developmentStages[number];
}

/** 後續交涉進度的資料格式, 協定 / 殖民地使用固定 ID, null 表示尚未建立 */
export interface CivilizationRelation {
  civilizationId: string;
  contact: 'uncontacted' | 'contacted';
  tradeAgreementId: string | null;
  colonialSettlementId: string | null;
}
export const initialCivilizationRelation = (civilizationId: string): CivilizationRelation => ({ civilizationId, contact: 'uncontacted', tradeAgreementId: null, colonialSettlementId: null });
