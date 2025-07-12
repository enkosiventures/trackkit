import { describe, it, expect, beforeEach, vi } from 'vitest';
import { init, getInstance, destroy } from '../src';

describe('Singleton behavior', () => {
  beforeEach(() => {
    destroy();
  });

  it('returns the same instance on multiple init calls', async () => {
    const first = init();
    const second = init();
    const third = init({ debug: true });
    
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(getInstance()).toBe(first);
  });

  it('warns about repeated initialization in debug mode', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    init({ debug: true });
    init({ debug: true });

    expect(consoleWarn).toHaveBeenCalledWith(
      '[trackkit] Analytics already initialized, returning existing instance'
    );
    
    consoleWarn.mockRestore();
  });

  it('creates new instance after destroy', async () => {
    const first = init();
    destroy();
    const second = init();
    
    expect(first).not.toBe(second);
  });
  
  it('maintains instance across imports', async () => {
    init();
    
    // Simulate another module importing trackkit
    const { getInstance: getInstanceFromAnotherImport } = await import('../src');
    
    expect(getInstance()).toBe(getInstanceFromAnotherImport());
  });
});