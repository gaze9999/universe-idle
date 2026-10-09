/** 額度單位為可使用 2x 的前景秒數; 離線兌換率 1.5:1, 最多 8 小時 */
/** enabled 保留 v4 欄位相容性, 載入後固定 true, 額度自動使用 */
export interface TimeBank { seconds: number; enabled: boolean }
export const bankLimit = 8 * 60 * 60;
export const defaultTimeBank = (): TimeBank => ({ seconds: 0, enabled: true });

export function creditTime(bank: TimeBank, offlineSeconds: number) {
  const received = Math.min(bankLimit - bank.seconds, Math.max(0, offlineSeconds) / 1.5);
  return { bank: { ...bank, seconds: bank.seconds + received, enabled: true }, received };
}

/** 共用世界時鐘推進, 到額度邊界後該區間剩餘時間按 1x 執行 */
export function spendTime(bank: TimeBank, foregroundSeconds: number) {
  const extra = Math.min(bank.seconds, Math.max(0, foregroundSeconds));
  return { bank: { ...bank, seconds: bank.seconds - extra, enabled: true }, acceleratedSeconds: extra, simulationSeconds: foregroundSeconds + extra };
}
