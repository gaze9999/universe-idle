import type { Command, GameState } from '../core/game';
import type { project } from './projection';
export type Tr = (key: string, values?: Record<string, string | number>) => string;
export interface PanelProps { state: GameState; t: Tr; send: (cmd: Command) => void; view: ReturnType<typeof project> }
const formats = new Map<string, Intl.NumberFormat>();
export function formatNumber(language: string, value: number, decimals = 0): string {
  const key = language + ':' + decimals;
  let format = formats.get(key);
  if (!format) { format = new Intl.NumberFormat(language, { maximumFractionDigits: decimals }); formats.set(key, format); }
  return format.format(value);
}
