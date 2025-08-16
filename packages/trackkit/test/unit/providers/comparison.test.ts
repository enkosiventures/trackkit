import { describe, it, expect } from 'vitest';
import { createFacade, createStatefulMock } from '../../helpers/providers';
import { grantConsent } from '../../../src';
import { navigate } from '../../helpers/navigation';

describe('Facade routes to active provider only', () => {
  it('swaps providers without double-sending', async () => {
    const { facade, provider } = await createFacade();
    grantConsent();

    // Ignore initial autotracked '/'
    provider.pageviewCalls.length = 0;

    await navigate('/a');
    expect(provider.pageviewCalls.map(c => c?.url)).toEqual(['/a']);

    // Create a fresh provider and attach
    const b = await createStatefulMock();
    expect(b.provider.pageviewCalls.length).toBe(0);

    facade.setProvider(b.stateful);
    b.provider.pageviewCalls.length = 0; // ignore new provider’s initial '/'

    await navigate('/b');

    // New provider got the new pageview, old one stayed as-is
    expect(b.provider.pageviewCalls.map(c => c?.url)).toEqual(['/b']);
    expect(provider.pageviewCalls.map(c => c?.url)).toEqual(['/a']);
  });
});
