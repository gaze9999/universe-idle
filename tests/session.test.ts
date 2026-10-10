import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/core/game';
import { backupKey, defaultPreferences, encodeSave, parseSave, saveKey } from '../src/platform/save';
import { GameSession } from '../src/session';
import { compressSave } from '../src/platform/transfer';

class MemoryStorage implements Storage {
  public failPrimary = false;
  public primaryWrites = 0;
  private data = new Map<string, string>();
  public get length() { return this.data.size; }
  public key(index: number) { return [...this.data.keys()][index] ?? null; }
  public getItem(key: string) { return this.data.get(key) ?? null; }
  public setItem(key: string, value: string): void {
    if (key === saveKey && this.failPrimary) throw new DOMException('quota', 'QuotaExceededError');
    if (key === saveKey) this.primaryWrites++;
    this.data.set(key, value);
  }
  public removeItem(key: string): void { this.data.delete(key); }
  public clear(): void { this.data.clear(); }
}
class MemoryChannel extends EventTarget {
  private static entries = new Set<MemoryChannel>();
  private closed = false;
  public constructor(public readonly name: string) { super(); MemoryChannel.entries.add(this); }
  public postMessage(data: unknown): void {
    for (const peer of MemoryChannel.entries) if (peer !== this && peer.name === this.name) void Promise.resolve().then(() => {
      if (!peer.closed) peer.dispatchEvent(Object.assign(new Event('message'), { data }));
    });
  }
  public close(): void { this.closed = true; MemoryChannel.entries.delete(this); }
}
let storage: MemoryStorage;
let now = 0;
let locked = false;
const sessions: GameSession[] = [];
function makeTab(focused = true) {
  return { page: Object.assign(new EventTarget(), { hidden: !focused, focused }), host: new EventTarget() };
}
const tabs = new Map<GameSession, ReturnType<typeof makeTab>>();
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(1_800_000_000_000);
  storage = new MemoryStorage(); now = 0; locked = false;
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('document', makeTab().page);
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('BroadcastChannel', MemoryChannel);
  const queue: { signal: AbortSignal; run: () => Promise<void>; resolve: () => void; reject: (error: unknown) => void }[] = [];
  const grant = (): void => {
    if (locked) return;
    const request = queue.shift();
    if (!request) return;
    locked = true;
    void (async () => {
      try { await request.run(); request.resolve(); }
      catch (error) { request.reject(error); }
      finally { locked = false; grant(); }
    })();
  };
  vi.stubGlobal('navigator', { locks: { request: (_name: string, options: { signal: AbortSignal }, run: () => Promise<void>) => new Promise<void>((resolve, reject) => {
    const request = { signal: options.signal, run, resolve, reject };
    if (options.signal.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
    options.signal.addEventListener('abort', () => {
      const index = queue.indexOf(request);
      if (index >= 0) { queue.splice(index, 1); reject(new DOMException('aborted', 'AbortError')); }
    }, { once: true });
    queue.push(request); grant();
  }) } });
});
afterEach(async () => {
  for (const session of sessions.splice(0)) session.dispose();
  tabs.clear(); await settle(); vi.unstubAllGlobals(); vi.useRealTimers();
});
async function settle(): Promise<void> { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
function start(clock?: () => number, tab = makeTab()): GameSession {
  vi.stubGlobal('document', tab.page); vi.stubGlobal('window', tab.host);
  const session = new GameSession(clock); sessions.push(session); tabs.set(session, tab); session.start(); return session;
}
function focus(session: GameSession, focused: boolean): void {
  const tab = tabs.get(session)!; tab.page.focused = focused; tab.page.hidden = !focused;
  tab.page.dispatchEvent(new Event('visibilitychange')); tab.host.dispatchEvent(new Event(focused ? 'focus' : 'blur'));
}
function readyReset(): string {
  const s = createGame();
  s.buildings = ['habitat', 'lumberyard', 'warehouse', 'laboratory', 'workshop', 'monument'];
  s.research = ['crafting', 'planning']; s.population.mineral = 2;
  return encodeSave(s, { ...defaultPreferences, paused: true }, Date.now());
}
describe('Session persistence and ownership', () => {
  it('never replaces an unsupported original when interrupted time is recovered', () => {
    const raw = JSON.parse(encodeSave(createGame(), defaultPreferences, Date.now())); raw.version = 999;
    const original = JSON.stringify(raw); storage.setItem(saveKey, original);
    const session = start(); const writes = storage.primaryWrites;
    expect(session.getSnapshot().notice).toBe('unsupportedSave');
    now = 6000; vi.advanceTimersByTime(6000);
    expect(storage.getItem(saveKey)).toBe(original); expect(storage.primaryWrites).toBe(writes);
    expect(session.getSnapshot().notice).toBe('unsupportedSave');
  });
  it('preserves an unsupported newer primary even when an older valid backup is available', () => {
    const backup = encodeSave(createGame(), defaultPreferences, Date.now() - 60_000);
    const raw = JSON.parse(backup); raw.version = 5;
    const original = JSON.stringify(raw); storage.setItem(saveKey, original); storage.setItem(backupKey, backup);
    const session = start(); const writes = storage.primaryWrites;
    expect(session.getSnapshot().notice).toBe('unsupportedSave');
    expect(session.getSnapshot().timeBank.seconds).toBe(0);
    now = 6000; vi.advanceTimersByTime(6000); session.save();
    expect(storage.getItem(saveKey)).toBe(original); expect(storage.getItem(backupKey)).toBe(backup);
    expect(storage.primaryWrites).toBe(writes);
  });
  it('credits a failed offline transaction once on retry without advancing or losing original progress', () => {
    const original = encodeSave(createGame(), defaultPreferences, Date.now() - 60_000);
    storage.setItem(saveKey, original); storage.failPrimary = true;
    const session = start();
    expect(session.getSnapshot().notice).toBe('storageError');
    expect(session.getSnapshot().timeBank.seconds).toBe(0);
    expect(storage.getItem(saveKey)).toBe(original);
    storage.failPrimary = false; now = 250; vi.advanceTimersByTime(250);
    expect(session.getSnapshot().timeBank.seconds).toBeCloseTo(60.25 / 1.5);
    expect(session.getSnapshot().state.elapsed).toBe(0);
    const bank = session.getSnapshot().timeBank.seconds;
    now = 500; vi.advanceTimersByTime(250);
    expect(session.getSnapshot().timeBank.seconds).toBeCloseTo(bank - .25);
    expect(session.getSnapshot().state.elapsed).toBe(.5);
  });
  it('handles an exhausted bank inside one frame, pauses consumption and can retain credit at 1x', () => {
    storage.setItem(saveKey, encodeSave(createGame(), defaultPreferences, Date.now(), { seconds: .1, enabled: true }));
    const session = start(); now = 250; vi.advanceTimersByTime(250);
    expect(session.getSnapshot().state.elapsed).toBeCloseTo(.35); expect(session.getSnapshot().timeBank.seconds).toBe(0);
    session.setPreferences({ paused: true }); now = 1250; vi.advanceTimersByTime(1000);
    expect(session.getSnapshot().state.elapsed).toBeCloseTo(.35);
  });
  it('automatically uses formerly disabled credit and preserves the remainder across Reset', () => {
    const raw = JSON.parse(readyReset()); raw.timeBank = { seconds: 3600, enabled: false }; raw.preferences.paused = false;
    storage.setItem(saveKey, JSON.stringify(raw)); const session = start();
    now = 250; vi.advanceTimersByTime(250);
    expect(session.getSnapshot().state.elapsed).toBe(.5); expect(session.getSnapshot().timeBank).toEqual({ seconds: 3599.75, enabled: true });
    session.dispatch({ type: 'reset', start: 'base' }); expect(session.getSnapshot().timeBank.seconds).toBe(3599.75);
    expect(parseSave(storage.getItem(saveKey)!).timeBank.seconds).toBe(3599.75);
  });
  it('clears acceleration when abandoning a run and persists it across handoff at normal speed', async () => {
    const raw = JSON.parse(readyReset()); raw.preferences.paused = false; raw.lastAt = Date.now() - 60000;
    raw.timeBank = { seconds: 3600, enabled: true }; storage.setItem(saveKey, JSON.stringify(raw));
    const session = start(); expect(session.getSnapshot().offline).toBe(40);
    session.dispatch({ type: 'reset', start: 'base', abandon: true });
    expect(session.getSnapshot().timeBank.seconds).toBe(0); expect(session.getSnapshot().offline).toBe(0);
    expect(parseSave(storage.getItem(saveKey)!).timeBank.seconds).toBe(0);
    expect(session.getSnapshot().state.legacy).toMatchObject({ points: 0, resets: 0 });
    expect(parseSave(storage.getItem(backupKey)!).timeBank.seconds).toBe(3640);
    now = 250; vi.advanceTimersByTime(250); expect(session.getSnapshot().state.elapsed).toBe(.25);
    const next = start(); await settle();
    expect(next.getSnapshot().readOnly).toBe(false); expect(next.getSnapshot().timeBank.seconds).toBe(0);
    expect(next.getSnapshot().state.elapsed).toBe(.25);
  });
  it('keeps acceleration and progress when abandon cannot be saved, then clears both on retry', () => {
    const raw = JSON.parse(readyReset()); raw.timeBank = { seconds: 3600, enabled: true };
    const previous = JSON.stringify(raw); storage.setItem(saveKey, previous);
    const session = start(); const state = structuredClone(session.getSnapshot().state);
    storage.failPrimary = true; session.dispatch({ type: 'reset', start: 'base', abandon: true });
    expect(session.getSnapshot().notice).toBe('storageError'); expect(session.getSnapshot().state).toEqual(state);
    expect(session.getSnapshot().timeBank.seconds).toBe(3600); expect(storage.getItem(saveKey)).toBe(previous);
    storage.failPrimary = false; session.dispatch({ type: 'reset', start: 'base', abandon: true });
    expect(session.getSnapshot().state.buildings).toEqual([]); expect(session.getSnapshot().timeBank.seconds).toBe(0);
    expect(parseSave(storage.getItem(saveKey)!).timeBank.seconds).toBe(0);
  });
  it('discards a compressed import if progress changes or ownership is handed off during decoding', async () => {
    const packed = await compressSave(readyReset()); const primary = start();
    const pending = primary.import(packed); primary.dispatch({ type: 'assign', sp: 'base', job: 'food', delta: 1 }); await pending;
    expect(primary.getSnapshot().state.buildings).toEqual([]); expect(primary.getSnapshot().state.assignments.base.food).toBe(1);
    const transferring = primary.import(packed); const secondary = start(); secondary.activate(); await settle(); await transferring;
    expect(primary.getSnapshot().readOnly).toBe(true); expect(secondary.getSnapshot().state.buildings).toEqual([]);
    expect(parseSave(storage.getItem(saveKey)!).state.buildings).toEqual([]);
  });
  it('saves Reset once before publishing, retains the prior run backup and cannot credit again', () => {
    const previous = readyReset(); storage.setItem(saveKey, previous);
    const session = start(); storage.primaryWrites = 0;
    session.dispatch({ type: 'reset', start: 'base' });
    expect(storage.primaryWrites).toBe(1); expect(storage.getItem(backupKey)).toBe(previous);
    expect(session.getSnapshot().state.legacy).toMatchObject({ points: 10, resets: 1 });
    expect(parseSave(storage.getItem(saveKey)!).state.legacy).toMatchObject({ points: 10, resets: 1 });
    session.dispatch({ type: 'reset', start: 'base' }); expect(storage.primaryWrites).toBe(1);
  });
  it('preserves the run and stored progress on a failed Reset, then credits once on retry', () => {
    const previous = readyReset(); storage.setItem(saveKey, previous);
    const session = start(); const state = structuredClone(session.getSnapshot().state);
    storage.failPrimary = true; session.dispatch({ type: 'reset', start: 'base' });
    expect(session.getSnapshot().state).toEqual(state); expect(session.getSnapshot().notice).toBe('storageError');
    expect(storage.getItem(saveKey)).toBe(previous);
    storage.failPrimary = false; session.dispatch({ type: 'reset', start: 'base' });
    expect(session.getSnapshot().state.legacy.points).toBe(10); expect(session.getSnapshot().state.legacy.resets).toBe(1);
  });
  it('preserves current progress on invalid import or storage failure', () => {
    storage.setItem(saveKey, encodeSave(createGame(), { ...defaultPreferences, paused: true }, Date.now()));
    const session = start(); const state = structuredClone(session.getSnapshot().state); const previous = storage.getItem(saveKey);
    session.import('{"invalid":true}'); expect(session.getSnapshot().notice).toBe('invalidSave');
    expect(session.getSnapshot().state).toEqual(state); expect(storage.getItem(saveKey)).toBe(previous);
    storage.failPrimary = true; session.import(readyReset());
    expect(session.getSnapshot().notice).toBe('storageError'); expect(session.getSnapshot().state).toEqual(state); expect(storage.getItem(saveKey)).toBe(previous);
  });
  it('uses one writable Session, caps the bank at 8 hours without advancing offline, and cleans up schedulers', () => {
    storage.setItem(saveKey, encodeSave(createGame(), defaultPreferences, Date.now() - 2 * 86400 * 1000));
    const primary = start(); expect(primary.getSnapshot().offline).toBe(28800); expect(primary.getSnapshot().state.elapsed).toBe(0); expect(primary.getSnapshot().timeBank.seconds).toBe(28800);
    const secondary = start(); expect(secondary.getSnapshot()).toMatchObject({ ready: true, readOnly: true, notice: null });
    expect(secondary.getSnapshot().state.elapsed).toBe(0);
    expect(vi.getTimerCount()).toBe(1); const writes = storage.primaryWrites;
    secondary.setPreferences({ language: 'en' }); secondary.dispatch({ type: 'assign', sp: 'base', job: 'wood', delta: -1 }); expect(storage.primaryWrites).toBe(writes);
    now = 250; vi.advanceTimersByTime(250); expect(primary.getSnapshot().state.elapsed).toBe(.5);
    primary.dispose(); secondary.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it('uses the supplied elapsed clock and saves using real wall time', () => {
    let elapsed = 0; const session = start(() => elapsed);
    elapsed = 1000; now = 250; vi.advanceTimersByTime(250);
    expect(session.getSnapshot().state.elapsed).toBe(1); expect(storage.primaryWrites).toBe(0);
    session.save(); expect(parseSave(storage.getItem(saveKey)!).lastAt).toBe(Date.now());
  });
  it('loads earlier saves while preserving assigned work and discarding obsolete preferences', () => {
    const state = createGame(); state.resources.wood = 100; state.assignments.base.wood = 2;
    const raw = JSON.parse(encodeSave(state, { ...defaultPreferences, paused: true }, Date.now()));
    raw.preferences.obsoleteOption = true; storage.setItem(saveKey, JSON.stringify(raw));
    const session = start(); expect(session.getSnapshot().preferences).toEqual({ ...defaultPreferences, language: 'zh-TW', paused: true }); expect(session.getSnapshot().state).toEqual(state);
    raw.preferences.paused = 'true'; expect(() => parseSave(JSON.stringify(raw))).toThrow('invalidSave');
  });
  it('continues the latest progress when switching tabs, with one writer and no duplicated time', async () => {
    const primary = start(); primary.dispatch({ type: 'assign', sp: 'base', job: 'wood', delta: 2 });
    const secondary = start(undefined, makeTab(false));
    now = 1000; vi.advanceTimersByTime(1000); focus(primary, false); focus(secondary, true); await settle();
    expect(primary.getSnapshot().readOnly).toBe(true); expect(secondary.getSnapshot().readOnly).toBe(false);
    expect(secondary.getSnapshot().state).toEqual(primary.getSnapshot().state);
    expect(secondary.getSnapshot().state.elapsed).toBe(1); expect(vi.getTimerCount()).toBe(1);
    const writes = storage.primaryWrites; primary.dispatch({ type: 'assign', sp: 'base', job: 'wood', delta: 1 }); expect(storage.primaryWrites).toBe(writes);
    now = 2000; vi.advanceTimersByTime(1000); secondary.setPreferences({ language: 'en' });
    focus(secondary, false); focus(primary, true); await settle();
    expect(primary.getSnapshot().readOnly).toBe(false); expect(primary.getSnapshot().state.elapsed).toBe(2);
    expect(primary.getSnapshot().state.assignments.base.wood).toBe(2); expect(primary.getSnapshot().preferences.language).toBe('en');
    expect(vi.getTimerCount()).toBe(1);
  });
  it('automatically takes over when the current page closes and preserves Reset credit once', async () => {
    storage.setItem(saveKey, readyReset());
    const primary = start(); const secondary = start(); primary.dispatch({ type: 'reset', start: 'base' });
    tabs.get(primary)!.host.dispatchEvent(new Event('pagehide')); await settle();
    expect(secondary.getSnapshot().readOnly).toBe(false); expect(secondary.getSnapshot().state.legacy.points).toBe(10);
    secondary.dispatch({ type: 'reset', start: 'base' }); expect(secondary.getSnapshot().state.legacy.points).toBe(10);
    expect(primary.getSnapshot().readOnly).toBe(true); expect(vi.getTimerCount()).toBe(1);
  });
  it('cancels an inactive waiting page and resumes it only when focused again', async () => {
    const primary = start(); const secondary = start(); focus(secondary, false); primary.dispose(); await settle();
    expect(secondary.getSnapshot().readOnly).toBe(true); expect(vi.getTimerCount()).toBe(0);
    focus(secondary, true); await settle(); expect(secondary.getSnapshot().readOnly).toBe(false); expect(vi.getTimerCount()).toBe(1);
    secondary.start(); expect(vi.getTimerCount()).toBe(1);
  });
  it('releases on pagehide and resumes a restored page with offline time settled once', async () => {
    const session = start(); session.dispatch({ type: 'assign', sp: 'base', job: 'food', delta: 1 });
    const tab = tabs.get(session)!; tab.host.dispatchEvent(new Event('pagehide')); await settle();
    now = 10_000; vi.advanceTimersByTime(10_000); expect(vi.getTimerCount()).toBe(0);
    tab.host.dispatchEvent(new Event('pageshow')); await settle();
    expect(session.getSnapshot().readOnly).toBe(false); expect(session.getSnapshot().state.elapsed).toBe(0); expect(session.getSnapshot().timeBank.seconds).toBeCloseTo(10 / 1.5);
    expect(session.getSnapshot().state.assignments.base.food).toBe(1); expect(vi.getTimerCount()).toBe(1);
  });
  it('keeps ownership and unsaved progress until a failed handoff save succeeds', async () => {
    const primary = start(); primary.dispatch({ type: 'assign', sp: 'base', job: 'wood', delta: 1 });
    const secondary = start(undefined, makeTab(false)); storage.failPrimary = true;
    now = 250; vi.advanceTimersByTime(250); focus(primary, false); focus(secondary, true); await settle();
    expect(primary.getSnapshot()).toMatchObject({ readOnly: false, notice: 'storageError' }); expect(secondary.getSnapshot().readOnly).toBe(true);
    const writes = storage.primaryWrites; secondary.save(); expect(storage.primaryWrites).toBe(writes);
    storage.failPrimary = false; now = 500; vi.advanceTimersByTime(250); await settle();
    expect(primary.getSnapshot().readOnly).toBe(true); expect(secondary.getSnapshot().readOnly).toBe(false);
    expect(secondary.getSnapshot().state.elapsed).toBe(.25); expect(secondary.getSnapshot().state.assignments.base.wood).toBe(1);
  });
  it('refreshes inactive progress from storage without advancing or writing', () => {
    const primary = start(); const secondary = start(undefined, makeTab(false));
    primary.dispatch({ type: 'assign', sp: 'base', job: 'food', delta: 2 }); const writes = storage.primaryWrites;
    tabs.get(secondary)!.host.dispatchEvent(Object.assign(new Event('storage'), { key: saveKey }));
    expect(secondary.getSnapshot().state).toEqual(primary.getSnapshot().state); expect(secondary.getSnapshot().offline).toBe(0);
    expect(storage.primaryWrites).toBe(writes); expect(secondary.getSnapshot().readOnly).toBe(true);
  });
  it('hands off across windows automatically on opening and interacting with either page', async () => {
    const primary = start(); primary.dispatch({ type: 'assign', sp: 'base', job: 'wood', delta: 1 });
    const secondary = start(); await settle();
    expect(primary.getSnapshot().readOnly).toBe(true); expect(secondary.getSnapshot().readOnly).toBe(false);
    secondary.dispatch({ type: 'assign', sp: 'base', job: 'food', delta: 1 }); tabs.get(primary)!.host.dispatchEvent(new Event('pointerdown')); await settle();
    expect(primary.getSnapshot().readOnly).toBe(false); expect(secondary.getSnapshot().readOnly).toBe(true);
    expect(primary.getSnapshot().state.assignments.base).toMatchObject({ wood: 1, food: 1 }); expect(vi.getTimerCount()).toBe(1);
    tabs.get(secondary)!.host.dispatchEvent(new Event('keydown')); await settle();
    expect(secondary.getSnapshot().readOnly).toBe(false); expect(primary.getSnapshot().readOnly).toBe(true); expect(vi.getTimerCount()).toBe(1);
    tabs.get(primary)!.host.dispatchEvent(new Event('click')); await settle(); expect(primary.getSnapshot().readOnly).toBe(false); expect(vi.getTimerCount()).toBe(1);
    secondary.activate(); await settle(); expect(secondary.getSnapshot().readOnly).toBe(false); expect(primary.getSnapshot().readOnly).toBe(true);
  });
  it('queues a safe takeover without BroadcastChannel when the owner closes', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const primary = start(); const secondary = start(); expect(secondary.getSnapshot().readOnly).toBe(true);
    primary.dispose(); await settle(); expect(secondary.getSnapshot().readOnly).toBe(false); expect(vi.getTimerCount()).toBe(1);
  });
  it('retries a requested cross-window handoff after storage recovers without another user action', async () => {
    const primary = start(); primary.dispatch({ type: 'assign', sp: 'base', job: 'food', delta: 1 }); storage.failPrimary = true;
    const secondary = start(); await settle();
    expect(primary.getSnapshot().notice).toBe('storageError'); expect(secondary.getSnapshot().readOnly).toBe(true);
    storage.failPrimary = false; now = 250; vi.advanceTimersByTime(250); await settle();
    expect(primary.getSnapshot().readOnly).toBe(true); expect(secondary.getSnapshot().readOnly).toBe(false);
    expect(secondary.getSnapshot().state.assignments.base.food).toBe(1); expect(vi.getTimerCount()).toBe(1);
  });
  it('returns ownership to an already-open page when the active page closes', async () => {
    const primary = start(); const secondary = start(); await settle();
    expect(primary.getSnapshot().readOnly).toBe(true); secondary.dispatch({ type: 'assign', sp: 'base', job: 'food', delta: 1 });
    tabs.get(secondary)!.host.dispatchEvent(new Event('pagehide')); await settle();
    expect(primary.getSnapshot().readOnly).toBe(false); expect(primary.getSnapshot().state.assignments.base.food).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
  });
});
