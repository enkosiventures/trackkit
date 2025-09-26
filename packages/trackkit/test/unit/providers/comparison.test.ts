import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockFacade, createStatefulMock } from '../../helpers/providers';
import { grantConsent } from '../../../src';
import { navigate } from '../../helpers/navigation';
import { resetTests } from '../../helpers/core';

describe('Facade routes to active provider only', () => {
  beforeEach(() => {
    resetTests();
  });

  afterEach(() => {
    resetTests();
  });

  it('swaps providers without double-sending', async () => {
    const { facade, provider } = await createMockFacade();
    grantConsent();

    const { pageviewCalls } = provider.diagnostics;

    // Ignore initial autotracked '/'
    pageviewCalls.length = 0;

    await navigate('/a');
    expect(pageviewCalls.map(c => c?.url)).toEqual(['/a']);

    // Create a fresh provider and attach
    const b = await createStatefulMock();
    const { pageviewCalls: bPageviewCalls } = b.provider.diagnostics;

    expect(bPageviewCalls.length).toBe(0);

    facade.setProvider(b.stateful);
    bPageviewCalls.length = 0; // ignore new provider’s initial '/'

    await navigate('/b');

    // New provider got the new pageview, old one stayed as-is
    expect(bPageviewCalls.map(c => c?.url)).toEqual(['/b']);
    expect(pageviewCalls.map(c => c?.url)).toEqual(['/a']);
  });
});
