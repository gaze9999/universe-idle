import { parseSave } from './save';

const prefix = 'UI3.';
const limit = 100_000;

/** gzip 保留完整 UTF-8 JSON 與小數精度; Base64 供文字貼上, 只壓縮匯出檔而不影響自動存檔 */
export async function compressSave(json: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return json;
  try {
    const bytes = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const compressed = prefix + btoa(binary);
    return compressed.length < json.length ? compressed : json;
  } catch { return json; }
}

/** 解壓串流逐段檢查大小, 避免小檔解壓成無上限資料; gzip 同時驗證完整性 */
export async function importSave(input: string) {
  const text = input.trim();
  if (text.length > limit) throw new Error('invalidSave');
  if (!text.startsWith(prefix)) return parseSave(text);
  if (typeof DecompressionStream === 'undefined') throw new Error('compressionUnsupported');
  const encoded = text.slice(prefix.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded) || !encoded) throw new Error('invalidSave');
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('invalidSave'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const decoded = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { decoded.set(chunk, offset); offset += chunk.byteLength; }
  return parseSave(new TextDecoder('utf-8', { fatal: true }).decode(decoded));
}
