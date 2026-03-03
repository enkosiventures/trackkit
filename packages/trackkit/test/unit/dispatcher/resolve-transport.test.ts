import { describe, it, expect, vi } from 'vitest';

import { resolveTransport, BeaconTransport, FetchTransport } from '../../../src/dispatcher/transports';
import * as detector from '../../../src/dispatcher/adblocker';


describe('resolveTransport', () => {
  it('returns Fetch when not blocked', async () => {
    vi.spyOn(detector, 'detectBlockers').mockResolvedValue({ blocked: false, confidence: 0.8 });
    const t = await resolveTransport('smart', { detectBlockers: true });
    expect(t).toBeInstanceOf(FetchTransport);
  });

  it('selects Beacon when blocked and strategy is beacon', async () => {
    vi.spyOn(detector, 'detectBlockers').mockResolvedValue({ blocked: true, method: 'dns', confidence: 0.9, fallback: 'beacon' });
    const t = await resolveTransport('smart', { detectBlockers: true, fallbackStrategy: 'beacon' });
    expect(t).toBeInstanceOf(BeaconTransport);
  });

  it('falls back to Beacon when strategy is none', async () => {
    vi.spyOn(detector, 'detectBlockers').mockResolvedValue({ blocked: true, method: 'script', confidence: 0.9 });
    const t = await resolveTransport('smart', { detectBlockers: true });
    expect(t).toBeInstanceOf(BeaconTransport);
  });
});
