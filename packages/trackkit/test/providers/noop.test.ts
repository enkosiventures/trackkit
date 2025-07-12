import { describe, it, expect, vi } from 'vitest';
import noopProvider from '../../src/providers/noop';

describe('No-op Provider', () => {
  it('implements all required methods', () => {
    const instance = noopProvider.create({ debug: false });
    
    expect(instance).toHaveProperty('track');
    expect(instance).toHaveProperty('pageview');
    expect(instance).toHaveProperty('identify');
    expect(instance).toHaveProperty('setConsent');
    expect(instance).toHaveProperty('destroy');
  });
  
  it('logs method calls in debug mode', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const instance = noopProvider.create({ debug: true });
    
    instance.track('test_event', { foo: 'bar' }, '/test');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[trackkit:noop] track',
      {
        name: 'test_event',
        props: { foo: 'bar' },
        url: '/test',
      }
    );
    
    consoleSpy.mockRestore();
  });
  
  it('does not log in production mode', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const instance = noopProvider.create({ debug: false });
    
    instance.track('test_event');
    
    expect(consoleSpy).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
  
  it('has provider metadata', () => {
    expect(noopProvider.meta).toEqual({
      name: 'noop',
      version: '1.0.0',
    });
  });
});