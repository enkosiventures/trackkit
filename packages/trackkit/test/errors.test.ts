import { describe, it, expect, vi, afterEach } from 'vitest';
import { init, destroy } from '../src';

describe('Error handling', () => {
  afterEach(() => destroy());
  
  it('calls error handler on initialization failure', () => {
    const onError = vi.fn();
    
    // Force an error by providing invalid config
    init({ 
      provider: 'invalid' as any,
      onError 
    });
    
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INIT_FAILED',
        message: expect.stringContaining('Unknown provider'),
      })
    );
  });
  
  it('returns no-op instance on init failure', () => {
    const onError = vi.fn();
    const instance = init({ 
      provider: 'invalid' as any,
      onError 
    });
    
    expect(instance).toBeDefined();
    expect(() => instance.track('test')).not.toThrow();
  });
  
  // it('safely handles errors in error callback', () => {
  //   const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    
  //   init({
  //     provider: 'invalid' as any,
  //     onError: () => {
  //       throw new Error('Callback error');
  //     }
  //   });
    
  //   expect(consoleError).toHaveBeenCalledWith(
  //     expect.stringContaining('[trackkit]'),
  //     expect.anything(),
  //     expect.stringContaining('Error in error handler')
  //   );
    
  //   consoleError.mockRestore();
  // });
  
  it('validates configuration', () => {
    const onError = vi.fn();
    
    init({
      queueSize: -1,
      onError
    });
    
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_CONFIG',
        message: expect.stringContaining('Queue size must be at least 1'),
      })
    );
  });
});