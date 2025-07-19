/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server } from '../setup-msw';
import { http, HttpResponse } from 'msw';
import umamiProvider from '../../src/providers/umami';
import type { AnalyticsOptions } from '../../src/types';

// @vitest-environment jsdom

// Enable MSW
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Umami Provider', () => {
  const validOptions: AnalyticsOptions = {
    siteId: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
    debug: true,
  };
  
  describe('initialization', () => {
    it('validates website ID', () => {
      expect(() => {
        umamiProvider.create({ ...validOptions, siteId: undefined });
      }).toThrow('Umami requires a valid website ID');
    });
    
    it('accepts various UUID formats', () => {
      const formats = [
        '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
        '9e1e6d6e7c0e4b0e8f0a5c5b5b5b5b5b',
        'data-website-id=9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
      ];
      
      formats.forEach(siteId => {
        expect(() => {
          umamiProvider.create({ ...validOptions, siteId });
        }).not.toThrow();
      });
    });
    
    it('returns no-op in non-browser environment', () => {
      // Mock SSR environment
      const originalWindow = global.window;
      delete (global as any).window;
      
      const instance = umamiProvider.create(validOptions);
      expect(() => instance.track('test')).not.toThrow();
      
      // Restore
      global.window = originalWindow;
    });
  });
  
  describe('tracking', () => {
    it('sends pageview events', async () => {
      const instance = umamiProvider.create(validOptions);
      instance.setConsent('granted');
      
      let capturedRequest: any;
      server.use(
        http.post('https://cloud.umami.is/api/send', async ({ request }) => {
          capturedRequest = await request.json();
          return HttpResponse.json({ ok: true });
        })
      );
      
      instance.pageview('/test-page');
      
      // Wait for async request
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(capturedRequest).toMatchObject({
        website: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
        url: '/test-page',
      });
    });
    
    it('sends custom events with data', async () => {
      const instance = umamiProvider.create(validOptions);
      instance.setConsent('granted');
      
      let capturedRequest: any;
      server.use(
        http.post('https://cloud.umami.is/api/send', async ({ request }) => {
          capturedRequest = await request.json();
          return HttpResponse.json({ ok: true });
        })
      );
      
      instance.track('button_click', { button_id: 'cta-hero' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(capturedRequest).toMatchObject({
        website: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
        name: 'button_click',
        data: { button_id: 'cta-hero' },
      });
    });
    
    it('respects consent state', async () => {
      const instance = umamiProvider.create(validOptions);
      
      let requestCount = 0;
      server.use(
        http.post('https://cloud.umami.is/api/send', () => {
          requestCount++;
          return HttpResponse.json({ ok: true });
        })
      );
      
      // Should not send without consent
      instance.track('no_consent');
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(requestCount).toBe(0);
      
      // Should send after consent granted
      instance.setConsent('granted');
      instance.track('with_consent');
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(requestCount).toBe(1);
      
      // Should stop after consent revoked
      instance.setConsent('denied');
      instance.track('consent_revoked');
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(requestCount).toBe(1);
    });
    
    it('handles network errors gracefully', async () => {
      const onError = vi.fn();
      const instance = umamiProvider.create({
        ...validOptions,
        host: 'https://error.example.com',
        onError,
      });
      instance.setConsent('granted');
      
      instance.track('test_event');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NETWORK_ERROR',
          provider: 'umami',
        })
      );
    });
  });
  
  describe('Do Not Track', () => {
    it('respects DNT header when enabled', () => {
      // Mock DNT
      Object.defineProperty(window.navigator, 'doNotTrack', {
        value: '1',
        configurable: true,
      });
      
      const instance = umamiProvider.create({
        ...validOptions,
        doNotTrack: true,
      });
      instance.setConsent('granted');
      
      let requestMade = false;
      server.use(
        http.post('*', () => {
          requestMade = true;
          return new HttpResponse(null, { status: 204 });
        })
      );
      
      instance.track('test');
      expect(requestMade).toBe(false);
      
      // Cleanup
      delete (window.navigator as any).doNotTrack;
    });
    
    it('ignores DNT when disabled', async () => {
      Object.defineProperty(window.navigator, 'doNotTrack', {
        value: '1',
        configurable: true,
      });
      
      const instance = umamiProvider.create({
        ...validOptions,
        doNotTrack: false,
      });
      instance.setConsent('granted');
      
      let requestMade = false;
      server.use(
        http.post('*', () => {
          requestMade = true;
          return new HttpResponse(null, { status: 204 });
        })
      );
      
      instance.track('test');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(requestMade).toBe(true);
      
      // Cleanup
      delete (window.navigator as any).doNotTrack;
    });
  });
});