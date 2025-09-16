import { describe, it, expect, beforeEach, afterEach, assert } from 'vitest';
import { setupAnalytics } from '../helpers/providers';
import { navigate } from '../helpers/navigation';
import { destroy, AnalyticsMode } from '../../src';

describe('Integration: real history + sandbox', () => {
  beforeEach(() => {
    // reset URL to a known baseline before every test
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    destroy();
  });

  (['factory', 'singleton'] as AnalyticsMode[]).forEach(mode => {

    it(`${mode} fires an initial pageview after consent with autoTrack`, async () => {
      const { provider } = await setupAnalytics({
        autoTrack: true,
        trackLocalhost: true,
        domains: ['localhost'],
      }, {
        mode,
        setConsent: 'granted',
      });

      // initial route “/”
      expect(provider?.pageviewCalls.map(c => c?.url)).toEqual(['/']);
    });

    it(`${mode} emits exactly once on pushState (no double-fire)`, async () => {
      const { provider } = await setupAnalytics({
        autoTrack: true,
        trackLocalhost: true,
        domains: ['localhost'],
      }, {
        mode,
        setConsent: 'granted',
      });

      await navigate('/x');
      expect(provider?.pageviewCalls.map(c => c?.url)).toEqual(['/', '/x']);

      // navigating to the same URL should not add another pageview
      await navigate('/x');
      expect(provider?.pageviewCalls.map(c => c?.url)).toEqual(['/', '/x']);
    });

    it(`${mode} handles popstate (back/forward)`, async () => {
      const { provider } = await setupAnalytics({
        autoTrack: true,
        trackLocalhost: true,
        domains: ['localhost'],
      }, {
        mode,
        setConsent: 'granted',
      });

      // /a then /b
      await navigate('/a');
      await navigate('/b');

      // back -> /a (manual popstate)
      await navigate('/a');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise(r => setTimeout(r, 0));

      // forward -> /b (manual popstate)
      await navigate('/b');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise(r => setTimeout(r, 0));

      expect(provider?.pageviewCalls.map(c => c?.url)).toEqual(['/', '/a', '/b', '/a', '/b']);
    });

    it(`${mode} respects \`exclude\` patterns (no emission for excluded paths)`, async () => {
      const { provider } = await setupAnalytics({
        autoTrack: true,
        trackLocalhost: true,
        domains: ['localhost'],
        exclude: ['/private/*', '/admin'],
      }, {
        mode,
        setConsent: 'granted',
      });

      await navigate('/private/area');
      await navigate('/admin');
      await navigate('/public');

      expect(provider?.pageviewCalls.map(c => c?.url)).toEqual(['/', '/public']);
    });

    it(`${mode} respects domain allowlist (no emission on non-matching host)`, async () => {
      const { provider } = await setupAnalytics({
        autoTrack: true,
        trackLocalhost: true,
        domains: ['example.com'], // does not include localhost
      }, {
        mode,
        setConsent: 'granted',
      });

      assert(provider);

      provider.pageviewCalls.length = 0;

      await navigate('/somewhere');
      expect(provider.pageviewCalls.length).toBe(0);

    });

    it(`${mode} includes hash in URL when \`includeHash: true\``, async () => {
      const { provider } = await setupAnalytics({
        autoTrack: true,
        trackLocalhost: true,
        domains: ['localhost'],
        includeHash: true,
      }, {
        mode,
        setConsent: 'granted',
      });

      // push a hash-only change
      window.location.hash = '#tab-2';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await new Promise(r => setTimeout(r, 0));

      expect(provider?.pageviewCalls.map(c => c?.url)).toEqual(['/', '/#tab-2']);
    });

    it(`${mode} unsubscribes listeners on destroy()`, async () => {
      const { facade, provider } = await setupAnalytics({
        autoTrack: true,
        domains: ['localhost'],
      }, {
        mode,
        setConsent: 'granted',
      });

      // remove navigation listeners
      if (mode === 'factory') {
        facade?.destroy();
      } else {
        destroy(); 
      }

      await navigate('/after-destroy');
      expect(provider?.pageviewCalls.length).toBe(0);
    });
  });
});
