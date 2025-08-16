import { describe, it, expect } from 'vitest';
import { AnalyticsError, dispatchError, setUserErrorHandler } from '../../../src/errors';

describe('Error pipeline', () => {
  it('invokes user error handler with AnalyticsError', () => {
    let seen: any = null;
    setUserErrorHandler((e) => { seen = e; });
    const err = new AnalyticsError('boom', 'INIT_FAILED', 'noop');
    dispatchError(err);
    expect(seen).toBeInstanceOf(AnalyticsError);
    expect(seen.code).toBe('INIT_FAILED');

    // restore default
    setUserErrorHandler(null);
  });
});
