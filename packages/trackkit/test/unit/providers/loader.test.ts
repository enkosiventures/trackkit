import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Provide constants used by loader
vi.mock('../../src/constants', () => ({
  DEFAULT_PROVIDER: 'noop',
  DEFAULT_PROVIDER_OPTIONS: { provider: 'noop' },
  DEFAULT_ERROR_HANDLER: vi.fn(),
}));

// Override the noop provider
let currentNoopFactory: any;
vi.mock('../../../src/providers/noop', () => ({
  get default() {
    return currentNoopFactory;
  },
}));

import { loadProvider } from '../../../src/providers/loader';
import { StatefulProvider } from '../../../src/providers/stateful-wrapper';
import * as Log from '../../../src/util/logger';
import { resetTests } from '../../helpers/core';


function mkProvider(name = 'p') {
  return {
    name,
    track: vi.fn(),
    pageview: vi.fn(),
    identify: vi.fn(),
    destroy: vi.fn(),
  };
}

describe('provider loader', () => {
  let logger: any;

  beforeEach(() => {
    currentNoopFactory = undefined;
    logger = vi.spyOn(Log, 'logger', 'get').mockReturnValue({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    });
    resetTests(vi);
  });

  afterEach(() => {
    resetTests(vi);
  });

  describe('Happy paths', () => {
    beforeEach(() => {
      const provider = mkProvider('noop-impl');
      currentNoopFactory = {
        create: () => provider,
        meta: { version: '1.2.3' },
      };
    });

    it('loads provider via SYNC factory and returns StatefulProvider', async () => {
      const sp = await loadProvider({ providerOptions: { provider: 'noop' }});
      expect(sp).toBeInstanceOf(StatefulProvider);

      const infoCalls = logger.mock.results?.[0]?.value?.info?.mock?.calls ?? [];
      expect(infoCalls).toEqual([['Provider loaded:', 'noop', { version: '1.2.3' }]]);
    });

    it('loads provider via ASYNC factory (promise)', async () => {
      const sp = await loadProvider({ providerOptions: null });
      expect(sp).toBeInstanceOf(StatefulProvider);
      const infoCalls = logger.mock.results?.[0]?.value?.info?.mock?.calls ?? [];
      expect(infoCalls).toEqual([['Provider loaded:', 'noop', { version: '1.2.3' }]]);
    });
  });

  it('throws on unknown provider name', async () => {
    await expect(loadProvider({ providerOptions: { provider: 'unknown' } as any })).rejects.toThrow(/Unknown analytics provider/i);
  });

  it('throws on invalid factory (missing create)', async () => {
    currentNoopFactory = {}; // no create
    await expect(loadProvider({ providerOptions: { provider: 'noop' } })).rejects.toThrow(/Invalid provider factory/i);
  });

  it('init failure is caught and forwarded to onError (no unhandled rejections)', async () => {
    const provider = mkProvider('failing');
    currentNoopFactory = { create: () => provider };

    const spyInit = vi.spyOn(StatefulProvider.prototype, 'init').mockRejectedValue(new Error('boom'));
    const onError = vi.fn();

    await loadProvider({
      providerOptions: { provider: 'noop' },
      bustCache: false,
      debug: false,
      onError,
    });
    expect(spyInit).toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
});
