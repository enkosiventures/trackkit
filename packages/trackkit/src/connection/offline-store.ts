import type { ConsentCategory } from "../consent/types";
import type { EventType } from "../types";

export type OfflineEvent = {
  type: EventType;
  args?: any[];
  url?: string;
  category?: ConsentCategory;
  timestamp: number;
};

export interface OfflineStorage {
  save(events: OfflineEvent[]): void | Promise<void>;
  load(): OfflineEvent[] | Promise<OfflineEvent[]>;
  clear(): void | Promise<void>;
}

export class LocalStorageStorage implements OfflineStorage {
  private key = 'trackkit_offline_events';
  async save(events: OfflineEvent[]) {
    const cur = await this.load();
    const merged = [...cur, ...events].slice(-1000);
    localStorage.setItem(this.key, JSON.stringify(merged));
  }
  async load() { try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch { return []; } }
  async clear() { localStorage.removeItem(this.key); }
}

export class OfflineStore {
  constructor(private storage: OfflineStorage = new LocalStorageStorage()) {}
  async saveOffline(e: OfflineEvent[]) { await this.storage.save(e); }
  async drainOffline() { const e = await this.storage.load(); if (e.length) await this.storage.clear(); return e; }
}