/**
 * Compile-time type tests for the typed events feature.
 *
 * These tests use vitest's `expectTypeOf` / `assertType` to verify that
 * the generic parameter on `createAnalytics<E>()` correctly constrains
 * `track()` calls at the type level.
 *
 * Run with: `pnpm vitest typecheck`
 */
import { describe, it, expectTypeOf, assertType } from 'vitest';
import { createAnalytics } from '../../../src/factory';
import { track as singletonTrack } from '../../../src/facade/singleton';
import type { AnalyticsInstance, EventMap, AnyEventMap } from '../../../src/types';
import type { AnalyticsFacade } from '../../../src/facade/index';

// -- Test event maps ---

type MyEvents = {
  signup_completed: { plan: 'free' | 'pro' };
  purchase: { amount: number; currency: string };
  page_scrolled: { depth: number };
};

type AllOptionalEvents = {
  button_click: { label?: string; variant?: string };
};

type NarrowEvents = {
  only_event: { value: number };
};

// -- Tests ---

describe('Typed events — compile-time checks', () => {
  it('unparameterised createAnalytics accepts any string name and any props', () => {
    const analytics = createAnalytics();
    assertType(analytics.track('anything', { any: 'props' }));
    assertType(analytics.track('something_else'));
    assertType(analytics.track('event', { nested: { deep: true } }));
  });

  it('typed createAnalytics accepts known event names with correct props', () => {
    const analytics = createAnalytics<MyEvents>();
    assertType(analytics.track('signup_completed', { plan: 'pro' }));
    assertType(analytics.track('purchase', { amount: 99, currency: 'USD' }));
    assertType(analytics.track('page_scrolled', { depth: 42 }));
  });

  it('typed createAnalytics rejects wrong props', () => {
    const analytics = createAnalytics<MyEvents>();

    // @ts-expect-error — 'gold' is not in 'free' | 'pro'
    analytics.track('signup_completed', { plan: 'gold' });

    // @ts-expect-error — 'amount' should be number, not string
    analytics.track('purchase', { amount: 'a lot', currency: 'USD' });
  });

  it('typed createAnalytics rejects unknown event names', () => {
    const analytics = createAnalytics<MyEvents>();

    // @ts-expect-error — 'unknown_event' is not in MyEvents
    analytics.track('unknown_event');

    // @ts-expect-error — typo: 'signup_complted' is not in MyEvents
    analytics.track('signup_complted');
  });

  it('typed track allows omitting props when all fields are optional', () => {
    const analytics = createAnalytics<AllOptionalEvents>();
    // No props — should compile because both fields are optional
    assertType(analytics.track('button_click'));
    assertType(analytics.track('button_click', { label: 'ok' }));
    assertType(analytics.track('button_click', {}));
  });

  it('singleton track accepts any string and any props (untyped)', () => {
    assertType(singletonTrack('anything', { foo: 'bar' }));
    assertType(singletonTrack('something'));
    assertType(singletonTrack('event', { a: 1, b: 'two' }));
  });

  it('AnalyticsFacade<MyEvents> is assignable to AnalyticsInstance<MyEvents>', () => {
    expectTypeOf<AnalyticsFacade<MyEvents>>().toMatchTypeOf<AnalyticsInstance<MyEvents>>();
  });

  it('AnalyticsFacade<MyEvents> is NOT assignable to AnalyticsInstance<NarrowEvents>', () => {
    expectTypeOf<AnalyticsFacade<MyEvents>>().not.toMatchTypeOf<AnalyticsInstance<NarrowEvents>>();
  });

  it('default type parameter is AnyEventMap', () => {
    expectTypeOf<AnalyticsFacade>().toEqualTypeOf<AnalyticsFacade<AnyEventMap>>();
    expectTypeOf<AnalyticsInstance>().toEqualTypeOf<AnalyticsInstance<AnyEventMap>>();
  });

  it('EventMap is Record<string, Record<string, unknown>>', () => {
    expectTypeOf<EventMap>().toEqualTypeOf<Record<string, Record<string, unknown>>>();
  });

  it('AnyEventMap equals EventMap', () => {
    expectTypeOf<AnyEventMap>().toEqualTypeOf<EventMap>();
  });
});
