import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineStore, LocalStorageStorage, type OfflineEvent } from '../../../src/connection/offline-store';

describe('OfflineStore', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('saves, loads, and drains events', async () => {
    const q = new OfflineStore(new LocalStorageStorage());
    const evts: OfflineEvent[] = [
      { type: 'pageview', url: '/', timestamp: 1 },
      { type: 'track', args: ['signup', { plan: 'pro' }], timestamp: 2 },
    ];

    await q.saveOffline(evts);

    const loaded = await new LocalStorageStorage().load();
    expect(loaded.length).toBe(2);

    const drained = await q.drainOffline();
    expect(drained.length).toBe(2);

    const after = await new LocalStorageStorage().load();
    expect(after.length).toBe(0);
  });

  it('caps stored events to last 1000', async () => {
    const q = new OfflineStore();
    await q.saveOffline(new Array(1100).fill(0).map((_, i) => ({ type: 'pageview', timestamp: i } as OfflineEvent)));
    const stored = await new LocalStorageStorage().load();
    expect(stored.length).toBe(1000);
    expect(stored[0].timestamp).toBeGreaterThan(0);
  });
});
