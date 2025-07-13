import { describe, it, expect, vi, afterEach, Mock } from 'vitest';
import { init, destroy, getInstance } from '../src';

// Helper so we don't repeat boiler-plate
async function waitForError(fn: Mock, timeout = 100) {
  await vi.waitFor(() => {
    if (!fn.mock.calls.length) throw new Error('no error yet');
  }, { timeout });
}

describe('Error handling (Stage 3)', () => {
  afterEach(() => destroy());

  it('invokes onError callback when provider load fails', async () => {
    const onError = vi.fn();

    // Trigger a failure → unknown provider
    init({ provider: 'imaginary' as any, onError });

    await waitForError(onError);

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INIT_FAILED',
        provider: 'imaginary',
      }),
    );

    // The proxy has already fallen back to noop — verify it’s usable
    const analytics = getInstance()!;
    expect(() => analytics.track('ok')).not.toThrow();
  });

  it('falls back to noop instance after failure', async () => {
    const onError = vi.fn();
    const proxy = init({ provider: 'broken' as any, onError });

    // The object returned by init is still the proxy:
    expect(proxy).toBeDefined();
    
    // Calls should not explode
    expect(() => proxy.pageview('/err')).not.toThrow();
  });

  // it('catches errors thrown inside onError handler', async () => {
  //   const consoleError = vi
  //     .spyOn(console, 'error')
  //     .mockImplementation(() => undefined);

  //   init({
  //     provider: 'ghost' as any,
  //     onError() {
  //       throw new Error('boom'); // user bug
  //     },
  //   });

  //   await vi.waitFor(() =>
  //     expect(consoleError).toHaveBeenCalledWith(
  //       expect.stringContaining('[trackkit]'),
  //       expect.anything(),
  //       expect.stringContaining('Error in error handler'),
  //     ),
  //   );

  //   consoleError.mockRestore();
  // });
});
