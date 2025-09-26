import { describe, it, expect, vi } from 'vitest';

import { resolveTransport } from '../../../src/dispatcher/resolve-transport';
import * as detector from '../../../src/dispatcher/adblocker';
import { BeaconTransport, FetchTransport } from '../../../src/dispatcher/transport';

describe('resolveTransport', () => {
  it('returns Fetch when not blocked', async () => {
    vi.spyOn(detector, 'detectBlockers').mockResolvedValue({ blocked: false, confidence: 0.8 });
    const t = await resolveTransport({ detectBlockers: true });
    expect(t).toBeInstanceOf(FetchTransport);
  });

  it('selects Beacon when blocked and strategy is beacon', async () => {
    vi.spyOn(detector, 'detectBlockers').mockResolvedValue({ blocked: true, method: 'dns', confidence: 0.9, fallback: 'beacon' });
    const t = await resolveTransport({ detectBlockers: true, fallbackStrategy: 'beacon' });
    expect(t).toBeInstanceOf(BeaconTransport);
  });

  it('falls back to Fetch when strategy is none', async () => {
    vi.spyOn(detector, 'detectBlockers').mockResolvedValue({ blocked: true, method: 'script', confidence: 0.9 });
    const t = await resolveTransport({ detectBlockers: true, fallbackStrategy: 'none' });
    expect(t).toBeInstanceOf(FetchTransport);
  });
});
