/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { grantConsent, destroy } from '../../src';
import { setupAnalytics } from '../helpers/providers';
import { navigate, navigateWithTick } from '../helpers/navigation';
import { resetTests } from '../helpers/core';

// @vitest-environment jsdom


describe('Facade autotrack with real history', () => {

  beforeEach(() => {
    resetTests();
  });

  afterEach(async () => {
    resetTests(vi);
  });

  it('sends initial pageview once', async () => {
    const { provider } = await setupAnalytics({
      autoTrack: true,
      includeHash: true,
      trackLocalhost: true,
    }, {
      mode: 'singleton',
      setConsent: 'granted',
    })

    const { pageviewCalls } = provider!.diagnostics;
    expect(pageviewCalls.length).toBe(1);
    expect(pageviewCalls[0]?.url).toBe('/');
  });

  it('sends SPA navigations and dedupes repeats', async () => {
    const { provider } = await setupAnalytics({
      autoTrack: true,
      includeHash: true,
      trackLocalhost: true,
    }, {
      mode: 'singleton',
      setConsent: 'granted',
    })

    await navigateWithTick('/a');
    await navigateWithTick('/a'); // duplicate
    await navigateWithTick('/b?x=1#h');

    const { pageviewCalls } = provider!.diagnostics;
    expect(pageviewCalls.map(c => c?.url)).toEqual(['/', '/a', '/b?x=1#h']);
    expect(pageviewCalls[1]?.referrer ?? '').toBe('/');  // A referrer
    expect(pageviewCalls[2]?.referrer ?? '').toBe('/a'); // B referrer
  });

  it('applies exclusions', async () => {
    const { provider } = await setupAnalytics({
      autoTrack: true,
      trackLocalhost: true,
      exclude: ['/secret/alpha'],
    }, {
      mode: 'singleton',
      setConsent: 'granted',
    })

    await navigateWithTick('/secret/alpha'); // excluded
    await navigateWithTick('/public');

    expect(provider!.diagnostics.pageviewCalls.map(c => c?.url)).toEqual(['/', '/public']);
  });

  it('gates by consent per policy', async () => {
    const { provider } = await setupAnalytics({
      autoTrack: true,
      trackLocalhost: true,
    }, {
      mode: 'singleton',
      setConsent: 'denied',
    })

    await new Promise(resolve => setTimeout(resolve, 50));

    await navigate('/pre-consent');

    await new Promise(resolve => setTimeout(resolve, 50));

    grantConsent();

    await new Promise(resolve => setTimeout(resolve, 50));
    await navigate('/after-consent');

    await new Promise(resolve => setTimeout(resolve, 50));

    const { pageviewCalls } = provider!.diagnostics;
    expect(pageviewCalls.length).toBe(1);
    expect(pageviewCalls[0]).toEqual(expect.objectContaining({
      url: '/after-consent',
      title: '',
      referrer: '',
      viewportSize: { width: 1024, height: 768 },
      screenSize: undefined,
      language: 'en-US',
      hostname: 'localhost',
      timestamp: expect.any(Number),
      userId: undefined
    }));
  });
});
