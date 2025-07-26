/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import plausibleProvider from '../../../src/providers/plausible';
import type { AnalyticsOptions } from '../../../src/types';
import { grantConsent } from '../../../src';

// @vitest-environment jsdom

describe('Plausible Provider', () => {
  let fetchSpy: any;
  
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('ok', { status: 202 })
    );
  });
  
  afterEach(() => {
    fetchSpy.mockRestore();
    vi.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('requires domain configuration', () => {
      expect(() => {
        plausibleProvider.create({});
      }).toThrow('Plausible requires a domain');
      
      expect(() => {
        plausibleProvider.create({ siteId: 'example.com' });
      }).not.toThrow();
    });
    
    it('parses domain from various formats', () => {
      const domains = [
        'example.com',
        'https://example.com',
        'https://example.com/',
        'subdomain.example.com',
      ];
      
      domains.forEach(siteId => {
        expect(() => {
          plausibleProvider.create({ siteId });
        }).not.toThrow();
      });
    });
    
    it('has correct metadata', () => {
      expect(plausibleProvider.meta).toEqual({
        name: 'plausible',
        version: '1.0.0',
      });
    });
  });
  
  describe('tracking', () => {
    it('sends events to Plausible API', async () => {
      console.warn("Running test");
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        trackLocalhost: true,
      });

      instance.track('Signup', { plan: 'pro' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://plausible.io/api/event',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Forwarded-For': '127.0.0.1',
          }),
        })
      );
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body).toMatchObject({
        n: 'Signup',
        d: 'example.com',
        m: { plan: 'pro' },
        w: expect.any(Number),
      });
    });
    
    it('uses custom host when provided', async () => {
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        host: 'https://analytics.example.com',
        trackLocalhost: true,
      });
      
      instance.track('test');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchSpy.mock.calls[0][0]).toBe('https://analytics.example.com/api/event');
    });
    
    it('converts all props to strings', async () => {
      const instance = plausibleProvider.create({
        siteId: 'example.com',
        trackLocalhost: true,
      });
      
      instance.track('test', {
        string: 'value',
        number: 123,
        boolean: true,
        null: null,
        undefined: undefined,
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.m).toEqual({
        string: 'value',
        number: '123',
        boolean: 'true',
      });
    });
    
    it('tracks revenue goals when enabled', async () => {
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        trackLocalhost: true,
        revenue: {
          currency: 'EUR',
          trackingEnabled: true,
        },
      });
      
      instance.track('Purchase', { 
        revenue: 29.99,
        currency: 'USD',
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.$).toBe(2999); // Cents
      expect(body.$$).toBe('USD');
    });
    
    it('does not track revenue when disabled', async () => {
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        trackLocalhost: true,
        revenue: {
          currency: 'USD',
          trackingEnabled: false,
        },
      });
      
      instance.track('Purchase', { revenue: 29.99 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.$).toBeUndefined();
    });
    
    it('excludes localhost by default', async () => {
      // Mock localhost
      const originalLocation = window.location;
      delete (window as any).location;
      // @ts-expect-error
      window.location = {
        ...originalLocation,
        hostname: 'localhost',
      } as Location;
      
      const instance = plausibleProvider.create({
        siteId: 'example.com',
      });
      instance.track('test');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchSpy).not.toHaveBeenCalled();
      
      // Restore
      // @ts-expect-error
      window.location = originalLocation;
    });
    
    it('can track localhost when enabled', async () => {
      // Mock localhost
      const originalLocation = window.location;
      delete (window as any).location;
      // @ts-expect-error
      window.location = {
        ...originalLocation,
        hostname: 'localhost',
      } as Location;
      
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        trackLocalhost: true,
      });
      
      instance.track('test');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchSpy).toHaveBeenCalled();
      
      // Restore
      // @ts-expect-error
      window.location = originalLocation;
    });
  });
  
  describe('pageview tracking', () => {
    it('sends pageview events', async () => {
      const instance = plausibleProvider.create({
        siteId: 'example.com',
        trackLocalhost: true,
      });
      
      instance.pageview('/page');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body).toMatchObject({
        n: 'pageview',
        d: 'example.com',
        u: '/page',
      });
    });
    
    it('includes hash when hashMode enabled', async () => {
      // Mock location with hash
      const originalLocation = window.location;
      delete (window as any).location;
      // @ts-expect-error
      window.location = {
        ...originalLocation,
        href: 'https://example.com/#/route',
      } as Location;
      
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        trackLocalhost: true,
        hashMode: true,
      });
      
      instance.pageview();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.h).toBe(1);
      expect(body.u).toContain('#/route');
      
      // Restore
      // @ts-expect-error
      window.location = originalLocation;
    });
    
    it('deduplicates repeated pageviews', async () => {
      const instance = plausibleProvider.create({
        siteId: 'example.com',
        trackLocalhost: true,
      });
      
      instance.pageview('/page');
      instance.pageview('/page'); // Duplicate
      instance.pageview('/other');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('exclusions', () => {
    it('excludes configured paths', async () => {
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        exclude: ['/admin/*', '/api/*'],
        trackLocalhost: true,
      });
      
      // Mock URLs
      const originalLocation = window.location;
      
      const mockUrl = (path: string) => {
        delete (window as any).location;
        // @ts-expect-error
        window.location = {
          ...originalLocation,
          href: `https://example.com${path}`,
          pathname: path,
        } as Location;
      };
      
      mockUrl('/admin/dashboard');
      instance.pageview();
      
      mockUrl('/api/users');
      instance.pageview();
      
      mockUrl('/public/page');
      instance.pageview();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      
      // Restore
      // @ts-expect-error
      window.location = originalLocation;
    });
  });
  
  describe('error handling', () => {
    it('calls onError callback on failure', async () => {
      const onError = vi.fn();
      fetchSpy.mockRejectedValue(new Error('Network error'));
      
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        trackLocalhost: true,
        onError,
      });
      
      instance.track('test');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NETWORK_ERROR',
          provider: 'plausible',
        })
      );
    });
    
    it('handles non-200 responses', async () => {
      const onError = vi.fn();
      fetchSpy.mockResolvedValue(
        new Response('Bad Request', { status: 400 })
      );
      
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        trackLocalhost: true,
        onError,
      });
      
      instance.track('test');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Plausible error'),
        })
      );
    });
  });
  
  // describe('auto-tracking', () => {
  //   it('sets up navigation callback when initialized', async () => {
  //     const instance = plausibleProvider.create({ 
  //       siteId: 'example.com',
  //       trackLocalhost: true,
  //       autoTrack: true,
  //     });
      
  //     // Set navigation callback
  //     const navigationCallback = vi.fn();
  //     instance._setNavigationCallback?.(navigationCallback);
      
  //     // Simulate navigation
  //     const newPath = '/new-page';
  //     window.history.pushState({}, '', newPath);
      
  //     await new Promise(resolve => setTimeout(resolve, 10));
      
  //     expect(navigationCallback).toHaveBeenCalledWith(newPath);
  //   });
  // });
  
  describe('custom properties', () => {
    it('includes default props in all events', async () => {
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        trackLocalhost: true,
        defaultProps: {
          author: 'john',
          section: 'blog',
        },
      });
      
      instance.track('Read Article', { title: 'Test Article' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.m).toEqual({
        author: 'john',
        section: 'blog',
        title: 'Test Article',
      });
    });
    
    it('allows overriding default props', async () => {
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        trackLocalhost: true,
        defaultProps: {
          section: 'blog',
        },
      });
      
      instance.track('test', { section: 'news' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.m.section).toBe('news');
    });
  });
});