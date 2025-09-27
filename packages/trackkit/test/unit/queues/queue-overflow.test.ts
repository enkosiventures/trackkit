import { describe, it, expect } from 'vitest';
import { AnalyticsFacade } from '../../../src/facade';
import type { AnalyticsError } from '../../../src/errors';
import { tick } from '../../helpers/core';

describe('Queue overflow', () => {
  it('dispatches QUEUE_OVERFLOW and keeps queue bounded', async () => {
    const errors: AnalyticsError[] = [];

    const facade = new AnalyticsFacade();
    facade.init({
      debug: true,
      domains: ['localhost'],
      queueSize: 1,
      consent: { initialStatus: 'pending', disablePersistence: true },
      onError: (e) => { errors.push(e as AnalyticsError); }, // <-- capture here
    });

    // Fill to max (1), then overflow with one more
    facade.track('a');
    facade.track('b');
    await tick(5);

    expect(facade.getQueueSize()).toBe(1);
    expect(errors.some(e => e.code === 'QUEUE_OVERFLOW')).toBe(true);
  });
});