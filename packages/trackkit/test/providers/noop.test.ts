import { describe, it, expect, vi, beforeEach } from 'vitest';
import noopProvider from '../../src/providers/noop';
import { track, destroy, init, waitForReady, grantConsent } from '../../src';

describe('No-op Provider', () => {
  beforeEach(() => {
    destroy();
  });

  it('implements all required methods', () => {
    const instance = noopProvider.create({ debug: false });
    
    expect(instance).toHaveProperty('track');
    expect(instance).toHaveProperty('pageview');
    expect(instance).toHaveProperty('identify');
    expect(instance).toHaveProperty('destroy');
  });

  it('logs method calls in debug mode', async () => {
    init({ debug: true });
    await waitForReady();
    grantConsent();

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    
    track('test_event', { foo: 'bar' }, '/test');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '%c[trackkit]',
      expect.any(String),
      '[no-op] track',
       {
         "name": "test_event",
         "props": {
           "foo": "bar",
         },
         "url": "/test",
       },
    );

    consoleSpy.mockRestore();
  });
  
  it('does not log in production mode', async () => {
    init({ debug: false });
    await waitForReady();

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    
    track('test_event');
    
    expect(consoleSpy).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});