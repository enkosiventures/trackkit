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

  private hasStorage(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  async save(events: OfflineEvent[]) {
    if (!this.hasStorage()) return;
    const cur = await this.load();
    const merged = [...cur, ...events].slice(-1000);
    window.localStorage.setItem(this.key, JSON.stringify(merged));
  }

  async load(): Promise<OfflineEvent[]> {
    if (!this.hasStorage()) return [];
    try {
      return JSON.parse(window.localStorage.getItem(this.key) || '[]');
    } catch {
      return [];
    }
  }

  async clear() {
    if (!this.hasStorage()) return;
    window.localStorage.removeItem(this.key);
  }
}


export class OfflineStore {
  constructor(private storage: OfflineStorage = new LocalStorageStorage()) {}
  async saveOffline(e: OfflineEvent[]) { await this.storage.save(e); }
  async drainOffline() { const e = await this.storage.load(); if (e.length) await this.storage.clear(); return e; }
}