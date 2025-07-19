import { describe, it, expect, beforeEach, vi } from 'vitest';
import { init, getInstance, destroy, waitForReady } from '../src';

describe('Singleton behavior', () => {
  beforeEach(() => {
    destroy();
  });

  it('reuses the same internal instance after multiple init calls', async () => {
    init({ provider: 'noop' });
    const instance1 = await waitForReady();

    init(); // should not trigger re-init
    const instance2 = await waitForReady();

    expect(instance1).toBe(instance2);
  });

  it('creates new instance after destroy', async () => {
    init();
    const firstInstance = await waitForReady();
    destroy();
    init();
    const secondInstance = await waitForReady();

    expect(firstInstance).not.toBe(secondInstance);
  });
  
  it('maintains instance across imports', async () => {
    init();
    
    // Simulate another module importing trackkit
    const { getInstance: getInstanceFromAnotherImport } = await import('../src');
    
    expect(getInstance()).toBe(getInstanceFromAnotherImport());
  });
});