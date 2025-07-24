import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import plausibleProvider from '../../../src/providers/plausible';
import { grantConsent } from '../../../src';

describe('Plausible Provider', () => {
  let fetchSpy: any;
  
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('ok', { status: 202 })
    );
  });
  
  afterEach(() => {
    fetchSpy.mockRestore();
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
  });
  
  describe('tracking', () => {
    it('sends events to Plausible API', async () => {
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
      });
      
      grantConsent();
      instance.track('Signup', { plan: 'pro' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://plausible.io/api/event',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body).toMatchObject({
        n: 'Signup',
        d: 'example.com',
        m: { plan: 'pro' },
      });
    });
    
    it('converts all props to strings', () => {
      const instance = plausibleProvider.create({ siteId: 'example.com' });
      grantConsent();
      
      instance.track('test', {
        string: 'value',
        number: 123,
        boolean: true,
        null: null,
      });
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.m).toEqual({
        string: 'value',
        number: '123',
        boolean: 'true',
      });
    });
    
    it('tracks revenue goals', () => {
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        revenue: {
          currency: 'EUR',
          trackingEnabled: true,
        },
      });
      
      grantConsent();
      instance.track('Purchase', { 
        revenue: 29.99,
        currency: 'USD',
      });
      
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.$).toBe(2999); // Cents
      expect(body.$$).toBe('USD');
    });
    
    it('excludes localhost by default', () => {
      Object.defineProperty(window.location, 'hostname', {
        value: 'localhost',
        configurable: true,
      });
      
      const instance = plausibleProvider.create({ siteId: 'example.com' });
      grantConsent();
      instance.track('test');
      
      expect(fetchSpy).not.toHaveBeenCalled();
      
      // Cleanup
      Object.defineProperty(window.location, 'hostname', {
        value: 'example.com',
        configurable: true,
      });
    });
    
    it('can track localhost when enabled', () => {
      Object.defineProperty(window.location, 'hostname', {
        value: 'localhost',
        configurable: true,
      });
      
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        trackLocalhost: true,
      });
      
      grantConsent();
      instance.track('test');
      
      expect(fetchSpy).toHaveBeenCalled();
    });
  });
  
  describe('pageview deduplication', () => {
    it('ignores duplicate pageviews', () => {
      const instance = plausibleProvider.create({ siteId: 'example.com' });
      grantConsent();
      
      instance.pageview('/page');
      instance.pageview('/page'); // Duplicate
      instance.pageview('/other');
      
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('exclusions', () => {
    it('excludes configured paths', () => {
      const instance = plausibleProvider.create({ 
        siteId: 'example.com',
        exclude: ['/admin/*', '/api/*'],
      });
      
      grantConsent();
      
      instance.pageview('/admin/dashboard');
      instance.pageview('/api/users');
      instance.pageview('/public/page');
      
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});