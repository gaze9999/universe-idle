/** 網頁快取與遊戲存檔分開; 新版等待舊頁關閉再啟用, 不強制重載進度 */
export async function registerOffline(base: string): Promise<boolean> {
  if (!navigator.onLine || !('serviceWorker' in navigator)) return false;
  try { await navigator.serviceWorker.register(base + 'sw.js', { scope: base }); return true; }
  catch { return false; }
}
