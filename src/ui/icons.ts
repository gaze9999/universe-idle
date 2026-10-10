/** 原創單色 SVG, 24 單位 viewBox, 全部使用 currentColor */
export interface GameSymbol { path: string }
export const gear: GameSymbol = { path: 'M10 2h4v3l3 2 3-1 2 4-3 2v3l3 2-2 4-3-1-3 2v3h-4v-3l-3-2-3 1-2-4 3-2v-3L0 10l2-4 3 1 5-2Zm2 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' };
export const close: GameSymbol = { path: 'M5 3 12 10 19 3 21 5 14 12 21 19 19 21 12 14 5 21 3 19 10 12 3 5Z' };
export const pause: GameSymbol = { path: 'M5 3h5v18H5Zm9 0h5v18h-5Z' };
export const play: GameSymbol = { path: 'M6 3 21 12 6 21Z' };
export const sun: GameSymbol = { path: 'M11 0h2v4h-2Zm0 20h2v4h-2ZM0 11h4v2H0Zm20 0h4v2h-4ZM3 4l1-1 3 3-1 1Zm14 14 1-1 3 3-1 1ZM3 20l3-3 1 1-3 3ZM17 6l3-3 1 1-3 3ZM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z' };
export const cloud: GameSymbol = { path: 'M4 19a4 4 0 0 1-1-8 6 6 0 0 1 11-4 5 5 0 0 1 5 2 5 5 0 0 1 0 10Zm1-2h14a3 3 0 0 0 0-6h-1l-1-2-4 1V8a4 4 0 0 0-8 3v2H4a2 2 0 0 0 1 4Z' };
export const leaf: GameSymbol = { path: 'M3 21 7 15C3 6 12 2 22 2c0 10-4 19-13 15l-4 6Zm6-7 9-8-11 6Zm2 1c5 1 8-2 9-9l-9 9Z' };
export const magic: GameSymbol = { path: 'M3 19 16 6l3 3L6 22Zm13-17 1-2 1 2 3 1-3 1-1 3-1-3-3-1ZM4 4l1-3 1 3 3 1-3 1-1 3-1-3-3-1Zm16 11 1-3 1 3 2 1-2 1-1 3-1-3-3-1Z' };
export const bolt: GameSymbol = { path: 'M13 0 4 14h7l-1 10 10-15h-7Z' };
export const signal: GameSymbol = { path: 'M0 7Q12-4 24 7l-2 2Q12 0 2 9Zm4 5q8-8 16 0l-2 2q-6-6-12 0Zm4 5q4-4 8 0l-4 5Z' };
