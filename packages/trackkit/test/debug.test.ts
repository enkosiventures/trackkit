import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { init, track, destroy, waitForReady } from '../src';

describe('Debug mode', () => {
  let consoleLog: any;
  let consoleInfo: any;
  
  beforeEach(() => {
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    destroy();
  });
  
  afterEach(() => {
    destroy();
    consoleLog.mockRestore();
    consoleInfo.mockRestore();
  });
  
  it('logs initialization in debug mode', async () => {
    init({ debug: true });
    await waitForReady();

    expect(consoleInfo).toHaveBeenCalledWith(
      expect.stringContaining('[trackkit]'),
      expect.anything(),
      'Initializing analytics',
      expect.objectContaining({
        provider: 'noop',
        debug: true,
      })
    );
  });
  
  it('logs method calls in debug mode', async () => {
    init({ debug: true });
    await waitForReady();

    track('test_event', { value: 42 });

    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('[trackkit]'),
      expect.anything(),
      '[no-op] track',
      expect.objectContaining({
        name: 'test_event',
        props: { value: 42 },
      })
    );
  });
  
  it('does not log in production mode', async () => {
    init({ debug: false });
    await waitForReady();

    track('test_event');

    expect(consoleLog).not.toHaveBeenCalled();
  });
});