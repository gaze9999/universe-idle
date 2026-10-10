import { advance, createGame, execute } from './core/game';
import type { Command, GameState } from './core/game';
import { initialWorld } from './core/world';
import { backupKey, bankMigrationKey, defaultPreferences, encodeSave, migrationKey, parseSave, readSave, saveKey, writeSave } from './platform/save';
import type { Preferences } from './platform/save';
import { compressSave, importSave } from './platform/transfer';
import { creditTime, defaultTimeBank, spendTime } from './core/time-bank';
import type { TimeBank } from './core/time-bank';

export interface Snapshot { state: GameState; preferences: Preferences; ready: boolean; readOnly: boolean; notice: string | null; offline: number; savedAt: number; timeBank: TimeBank }

/** 每個頁面僅一個 Session; 定時摘要每秒 4 次, 指令即時回饋, Core 共用世界時鐘 */
export class GameSession {
  private state = createGame();
  private preferences = { ...defaultPreferences };
  private timeBank = defaultTimeBank();
  private snapshot: Snapshot = { state: this.state, preferences: this.preferences, ready: false, readOnly: true, notice: null, offline: 0, savedAt: 0, timeBank: this.timeBank };
  private listeners = new Set<() => void>();
  private lastPerf = 0;
  private lastRealPerf = 0;
  private lastAt = 0;
  private lastWrite = 0;
  private wasHidden = false;
  private blockedSave = false;
  private pendingCredit = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private release: (() => void) | null = null;
  private pending: AbortController | null = null;
  private started = false;
  private suspended = false;
  private owner = false;
  private handingOff = false;
  private channel: BroadcastChannel | null = null;
  private readonly page = document;
  private readonly host = window;

  public constructor(private readonly clock: () => number = () => performance.now()) {}

  public getSnapshot = (): Snapshot => this.snapshot;
  public subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => void this.listeners.delete(listener); };
  private publish(patch: Partial<Snapshot> = {}): void {
    this.snapshot = { ...this.snapshot, ...patch, state: structuredClone(this.state), preferences: { ...this.preferences }, timeBank: { ...this.timeBank } };
    for (const listener of this.listeners) listener();
  }
  public start(): void {
    if (this.started) return;
    if (!navigator.locks) { this.publish({ ready: true, readOnly: true, notice: 'browserUnsupported' }); return; }
    this.started = true;
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('universe-idle/session-v1');
      this.channel.addEventListener('message', this.onMessage);
    }
    this.load(false);
    this.publish({ ready: true });
    this.page.addEventListener('visibilitychange', this.onActivity);
    this.host.addEventListener('focus', this.onActivity);
    this.host.addEventListener('blur', this.onActivity);
    this.host.addEventListener('pointerdown', this.onActivity, true);
    this.host.addEventListener('click', this.onActivity, true);
    this.host.addEventListener('keydown', this.onActivity, true);
    this.host.addEventListener('pagehide', this.onPageHide);
    this.host.addEventListener('pageshow', this.onPageShow);
    this.host.addEventListener('storage', this.onStorage);
    this.onActivity();
  }
  private onActivity = (event?: Event): void => {
    if (!this.started || this.suspended) return;
    if (this.page.hidden) { this.pending?.abort(); this.pending = null; }
    if (this.page.hidden || event?.type === 'blur') { if (this.owner) { if (this.page.hidden) this.leave(); else { this.tick(); this.save(); } } return; }
    if (this.owner) { if (event?.type === 'focus' || event?.type === 'visibilitychange') this.tick(); return; }
    if (this.pending) { this.channel?.postMessage('continue'); return; }
    const pending = new AbortController();
    this.pending = pending;
    void navigator.locks.request('universe-idle/session-v1', { signal: pending.signal }, async () => {
      if (this.pending === pending) this.pending = null;
      if (!this.started || this.suspended || this.page.hidden) return;
      this.owner = true;
      const released = new Promise<void>(resolve => { this.release = resolve; });
      this.load();
      this.lastPerf = this.clock();
      this.lastRealPerf = performance.now();
      this.lastWrite = performance.now();
      this.wasHidden = this.page.hidden;
      this.publish({ readOnly: false });
      this.timer = setInterval(() => {
        if (this.handingOff) this.leave();
        else if (!this.page.hidden) this.tick();
      }, 250);
      await released;
    }).catch(error => {
      if (this.pending === pending) this.pending = null;
      if (!this.started || pending.signal.aborted) return;
      this.publish({ readOnly: true, notice: error instanceof Error && error.name === 'AbortError' ? null : 'sessionError' });
    });
    this.channel?.postMessage('continue');
  };
  private onMessage = (event: MessageEvent): void => {
    if (event.data === 'continue' && this.owner) this.leave();
    else if (event.data === 'closed' && !this.owner && !this.pending) this.onActivity();
  };
  public activate(): void { this.onActivity(); }
  /** 接手後才兌換額度; 與截止時間一起保存成功後發布, 其他頁面只讀取快照 */
  private load(settle = true): void {
    try {
      this.pendingCredit = false;
      const loaded = readSave(localStorage);
      this.blockedSave = loaded.blocked;
      if (loaded.save) {
        this.state = loaded.save.state;
        this.preferences = loaded.save.preferences;
        this.timeBank = loaded.save.timeBank;
        const nowAt = Date.now();
        const gap = nowAt - loaded.save.lastAt;
        this.lastAt = loaded.save.lastAt;
        const credit = creditTime(this.timeBank, !settle || this.preferences.paused ? 0 : Math.max(0, gap / 1000));
        if (settle && gap > 0) {
          try { writeSave(localStorage, encodeSave(this.state, this.preferences, nowAt, credit.bank)); }
          catch { this.publish({ notice: 'storageError', offline: 0, savedAt: loaded.save.lastAt }); this.pendingCredit = true; return; }
          this.lastAt = nowAt;
          this.timeBank = credit.bank;
        }
        this.publish({ offline: credit.received, notice: gap < 0 ? 'clockBackwards' : loaded.notice, savedAt: this.lastAt });
      } else {
        this.state = createGame(initialWorld(crypto.getRandomValues(new Uint32Array(1))[0]));
        this.preferences = { ...defaultPreferences };
        this.timeBank = defaultTimeBank();
        this.lastAt = Date.now();
        this.publish({ notice: loaded.notice, offline: 0, savedAt: 0 });
      }
    } catch { this.blockedSave = true; this.lastAt = Date.now(); this.publish({ notice: 'storageError' }); }
  }
  private tick(): void {
    if (!this.owner || this.snapshot.readOnly || !this.snapshot.ready) return;
    try {
      const now = this.clock();
      const realNow = performance.now();
      const nowAt = Date.now();
      const seconds = Math.max(0, (now - this.lastPerf) / 1000);
      const realSeconds = Math.max(0, (realNow - this.lastRealPerf) / 1000);
      const wallSeconds = Math.max(0, (nowAt - this.lastAt) / 1000);
      const interrupted = this.pendingCredit || this.wasHidden || realSeconds > 5 || wallSeconds > realSeconds + 2;
      if (interrupted && this.blockedSave) {
        this.lastPerf = now;
        this.lastRealPerf = realNow;
        this.lastAt = Math.max(this.lastAt, nowAt);
        this.wasHidden = this.page.hidden;
        this.publish();
        return;
      }
      let received = 0;
      if (interrupted) {
          const credit = creditTime(this.timeBank, this.preferences.paused ? 0 : wallSeconds);
          const lastAt = Math.max(this.lastAt, nowAt);
          try { writeSave(localStorage, encodeSave(this.state, this.preferences, lastAt, credit.bank)); }
          catch { this.pendingCredit = true; this.lastPerf = now; this.lastRealPerf = realNow; this.publish({ notice: 'storageError' }); return; }
          this.timeBank = credit.bank;
          received = credit.received;
          this.lastWrite = performance.now();
          this.pendingCredit = false;
      } else if (!this.preferences.paused) {
          const spending = spendTime(this.timeBank, seconds);
          const next = structuredClone(this.state);
          const accelerated = spending.acceleratedSeconds;
          const acceleratedReal = seconds > 0 ? realSeconds * accelerated / seconds : 0;
          const realStart = nowAt - realSeconds * 1000;
          if (accelerated > 0) advance(next, accelerated * 2, realStart, acceleratedReal);
          if (seconds > accelerated) advance(next, seconds - accelerated, realStart + acceleratedReal * 1000, realSeconds - acceleratedReal);
          this.state = next;
          this.timeBank = spending.bank;
      }
      this.lastPerf = now;
      this.lastRealPerf = realNow;
      this.lastAt = Math.max(this.lastAt, nowAt);
      this.wasHidden = this.page.hidden;
      this.publish(received > 2 ? { offline: received } : {});
      if (performance.now() - this.lastWrite >= 30_000) this.save();
    } catch { this.preferences.paused = true; this.publish({ notice: 'simulationError' }); }
  }
  private leave(force = false): void {
    this.pending?.abort();
    this.pending = null;
    if (!this.owner) return;
    this.handingOff = true;
    this.tick();
    if (!this.save() && !force) return;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.handingOff = false;
    this.owner = false;
    this.publish({ readOnly: true, notice: null, offline: 0 });
    const release = this.release;
    this.release = null;
    release?.();
  }
  private onPageHide = (): void => {
    this.suspended = true; const owned = this.owner; this.leave(true);
    if (owned) this.channel?.postMessage('closed');
  };
  private onPageShow = (): void => { this.suspended = false; this.onActivity(); };
  private onStorage = (event: StorageEvent): void => {
    if (!this.owner && (event.key === saveKey || event.key === null)) this.load(false);
  };
  public save(): boolean {
    if (!this.owner || this.snapshot.readOnly || this.blockedSave) return false;
    try {
      writeSave(localStorage, encodeSave(this.state, this.preferences, this.lastAt, this.timeBank));
      this.lastWrite = performance.now();
      this.publish({ savedAt: this.lastAt });
      return true;
    } catch { this.publish({ notice: 'storageError' }); return false; }
  }
  public dispatch(cmd: Command): void {
    if (this.snapshot.readOnly || !this.snapshot.ready) return;
    this.tick();
    const next = structuredClone(this.state);
    const error = execute(next, cmd, Date.now());
    if (error) { this.publish({ notice: error }); return; }
    if (cmd.type === 'reset') {
      if (this.blockedSave) { this.publish({ notice: 'damagedSave' }); return; }
      const timeBank = cmd.abandon ? defaultTimeBank() : this.timeBank;
      try { writeSave(localStorage, encodeSave(next, this.preferences, this.lastAt, timeBank)); }
      catch { this.publish({ notice: 'storageError' }); return; }
      this.state = next;
      this.timeBank = timeBank;
      this.lastWrite = performance.now();
      this.publish({ notice: null, savedAt: this.lastAt, offline: cmd.abandon ? 0 : this.snapshot.offline });
      return;
    }
    this.state = next;
    this.publish({ notice: null });
    this.save();
  }
  public setPreferences(patch: Partial<Preferences>): void {
    if (this.snapshot.readOnly) return;
    this.tick();
    this.preferences = { ...this.preferences, ...patch };
    this.publish();
    this.save();
  }
  public dismissNotice(): void { this.publish({ notice: null, offline: 0 }); }
  public export(): Promise<string> { this.tick(); return compressSave(encodeSave(this.state, this.preferences, this.lastAt, this.timeBank)); }
  public rawSave(): string { return localStorage.getItem(saveKey) ?? ''; }
  public preUpgradeSave(): string { return localStorage.getItem(bankMigrationKey) ?? localStorage.getItem(migrationKey) ?? ''; }
  public async import(text: string): Promise<void> {
    if (this.snapshot.readOnly) return;
    const current = this.state;
    try {
      const imported = text.trim().startsWith('{') ? parseSave(text.trim()) : await importSave(text);
      if (this.snapshot.readOnly || !this.started || this.suspended || this.state !== current) return;
      const nowAt = Date.now();
      const gap = nowAt - imported.lastAt;
      const credit = creditTime(imported.timeBank, imported.preferences.paused ? 0 : Math.max(0, gap / 1000));
      const lastAt = Math.max(nowAt, imported.lastAt);
      try { writeSave(localStorage, encodeSave(imported.state, imported.preferences, lastAt, credit.bank)); }
      catch { this.publish({ notice: 'storageError' }); return; }
      this.state = imported.state;
      this.preferences = imported.preferences;
      this.timeBank = credit.bank;
      this.lastAt = lastAt;
      this.lastPerf = this.clock();
      this.lastRealPerf = performance.now();
      this.blockedSave = false;
      this.publish({ notice: gap < 0 ? 'clockBackwards' : 'imported', offline: credit.received, savedAt: lastAt });
    } catch (error) { this.publish({ notice: error instanceof Error && ['unsupportedSave', 'compressionUnsupported'].includes(error.message) ? error.message : 'invalidSave' }); }
  }
  public recoverBackup(): void {
    try { const backup = localStorage.getItem(backupKey); if (backup) void this.import(backup); else this.publish({ notice: 'noBackup' }); }
    catch { this.publish({ notice: 'storageError' }); }
  }
  public dispose(): void {
    this.started = false;
    const owned = this.owner;
    this.leave(true);
    if (owned) this.channel?.postMessage('closed');
    this.page.removeEventListener('visibilitychange', this.onActivity);
    this.host.removeEventListener('focus', this.onActivity);
    this.host.removeEventListener('blur', this.onActivity);
    this.host.removeEventListener('pointerdown', this.onActivity, true);
    this.host.removeEventListener('click', this.onActivity, true);
    this.host.removeEventListener('keydown', this.onActivity, true);
    this.host.removeEventListener('pagehide', this.onPageHide);
    this.host.removeEventListener('pageshow', this.onPageShow);
    this.host.removeEventListener('storage', this.onStorage);
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
  }
}
