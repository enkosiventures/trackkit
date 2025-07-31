import { describe, it, expect, vi } from 'vitest';
import { createFacade } from '../helpers/providers';
import { navigate } from '../helpers/navigation';
import { grantConsent } from '../../src';


describe('Integration: real history + sandbox', () => {
  it('emits on pushState/popstate and resets between tests', async () => {
    const { facade, provider } = await createFacade({
      autoTrack: true,
      domains: ['localhost'],
      exclude: [],
    });

    await facade.init?.();

    grantConsent();

    provider.pageviewCalls.length = 0;

    await navigate('/x');

    // If your sandbox also emits from popstate, simulate it explicitly:
    // window.dispatchEvent(new PopStateEvent('popstate'));

    // Use waitFor to avoid arbitrary sleeps
    expect(provider.pageviewCalls.map(c => c.url)).toEqual(['/x']);
  });
});
