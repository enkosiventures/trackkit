// /// <reference types="vitest" />
// import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
// import { init, destroy, grantConsent, denyConsent, resetConsent, getConsent } from '../../../src';
// import umamiProvider from '../../../src/providers/umami';
// import plausibleProvider from '../../../src/providers/plausible';
// import ga4Provider from '../../../src/providers/ga4';
// import type { ProviderFactory } from '../../../src/providers/types';
// import { TEST_SITE_ID } from '../../setup-umami';
// import { debugLog } from '../../../src/util/logger';

// // @vitest-environment jsdom

// describe('Provider API Consistency', () => {
//   const providers: Array<{ 
//     name: string; 
//     factory: ProviderFactory;
//     config: any;
//   }> = [
//     // { 
//     //   name: 'umami',
//     //   factory: umamiProvider,
//     //   config: { provider: 'umami', siteId: TEST_SITE_ID },
//     // },
//     // { 
//     //   name: 'plausible',
//     //   factory: plausibleProvider,
//     //   config: { provider: 'plausible', siteId: 'test.com' },
//     // },
//     { 
//       name: 'ga4',
//       factory: ga4Provider,
//       config: { provider: 'ga', siteId: 'G-TEST123456' },
//     },
//   ];

//   let fetchSpy: any;
  
//   beforeEach(() => {
//     destroy();
//     vi.clearAllMocks();
//     // Mock fetch for all tests to prevent real requests
//     fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
//       new Response('ok', { status: 200 })
//     );
//   });

//   afterEach(async () => {
//     fetchSpy.mockRestore();

//     // Wait for any pending async operations to complete
//     // await new Promise(resolve => setTimeout(resolve, 100));
    
//     // Clear all mocks
//     vi.clearAllMocks();
//     vi.restoreAllMocks();
//   });
  
//   // describe('Provider Metadata', () => {
//   //   providers.forEach(({ name, factory }) => {
//   //     it(`${name} has required metadata`, () => {
//   //       expect(factory.meta).toBeDefined();
//   //       // @ts-expect-error - ignore possible undefined error
//   //       expect(factory.meta.name).toBe(name);
//   //       // @ts-expect-error - ignore possible undefined error
//   //       expect(factory.meta.version).toMatch(/^\d+\.\d+\.\d+$/);
//   //     });
//   //   });
//   // });
  
//   // describe('Provider Creation', () => {
//   //   providers.forEach(({ name, factory, config }) => {
//   //     it(`${name} validates configuration`, () => {
//   //       // Should throw without siteId
//   //       expect(() => {
//   //         factory.create({});
//   //       }).toThrow();
        
//   //       // Should succeed with valid config
//   //       expect(() => {
//   //         factory.create(config);
//   //       }).not.toThrow();
//   //     });
      
//   //     it(`${name} creates instance with required methods`, () => {
//   //       const instance = factory.create(config);
        
//   //       // Required methods
//   //       expect(instance).toHaveProperty('name', name);
//   //       expect(typeof instance.track).toBe('function');
//   //       expect(typeof instance.pageview).toBe('function');
//   //       expect(typeof instance.identify).toBe('function');
//   //       expect(typeof instance.destroy).toBe('function');
        
//   //       // Optional lifecycle methods
//   //       if (instance._init) {
//   //         expect(typeof instance._init).toBe('function');
//   //       }
//   //       if (instance._setNavigationCallback) {
//   //         expect(typeof instance._setNavigationCallback).toBe('function');
//   //       }
//   //     });
//   //   });
//   // });
  
//   // describe('Tracking Methods', () => {
//   //   providers.forEach(({ name, factory, config }) => {
//   //     it(`${name} handles tracking calls without errors`, () => {
//   //       const instance = factory.create(config);
        
//   //       expect(() => {
//   //         instance.track('test_event', { value: 42 });
//   //         instance.pageview('/test-page');
//   //         instance.identify('user-123');
//   //       }).not.toThrow();
//   //     });
      
//   //     it(`${name} supports optional parameters`, () => {
//   //       const instance = factory.create(config);
        
//   //       expect(() => {
//   //         instance.track('minimal');
//   //         instance.track('with_props', { key: 'value' });
//   //         instance.track('with_url', {}, '/custom-url');
//   //         instance.pageview();
//   //         instance.pageview('/page');
//   //         instance.identify(null);
//   //       }).not.toThrow();
//   //     });
//   //   });
//   // });
  
//   // TODO: handle plausible & ga4 failure
//   describe('Navigation Tracking', () => {
//     providers.forEach(({ name, factory, config }) => {
//       it(`${name} supports navigation callbacks`, async () => {
//         const navigationCallback = vi.fn();
        
//         // Create instance
//         const instance = factory.create({
//           ...config,
//           autoTrack: true,
//         });
        
//         if (instance._setNavigationCallback) {
//           // Set callback BEFORE init
//           instance._setNavigationCallback(navigationCallback);
          
//           if (instance._init) {
//             await instance._init();
//           }
          
//           // Wait for navigation tracker to be fully initialized
//           await new Promise(resolve => setTimeout(resolve, 50));
          
//           // Simulate navigation
//           const newPath = '/new-page';
//           window.history.pushState({}, '', newPath);
          
//           // Wait for async operations
//           await new Promise(resolve => setTimeout(resolve, 100));
          
//           expect(navigationCallback).toHaveBeenCalledWith(newPath);
//         }
//       });
//     });
//   });
  
//   // describe('Lifecycle Management', () => {
//   //   providers.forEach(({ name, factory, config }) => {
//   //     it(`${name} cleans up on destroy`, async () => {
//   //       const instance = factory.create({ ...config, autoTrack: true });
        
//   //       if (instance._init) {
//   //         await instance._init();
//   //       }
        
//   //       const originalPushState = window.history.pushState;
        
//   //       instance.destroy();
        
//   //       // Should restore original methods
//   //       expect(window.history.pushState).toBe(originalPushState);
//   //     });
//   //   });
//   // });
  
//   // describe('Provider-Specific Behavior', () => {

//   //   it('Umami respects Do Not Track', async () => {
//   //     // Mock the browser's DNT setting
//   //     Object.defineProperty(navigator, 'doNotTrack', {
//   //       value: '1',
//   //       configurable: true,
//   //     });
      
//   //     // const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
//   //     //   new Response('ok', { status: 200 })
//   //     // );
      
//   //     const instance = umamiProvider.create({
//   //       siteId: TEST_SITE_ID,
//   //       doNotTrack: true, // Honor DNT if enabled
//   //     });

//   //     // Verify the mock is working
//   //     const { isDoNotTrackEnabled } = await import('../../../src/providers/shared/browser');
//   //     expect(isDoNotTrackEnabled()).toBe(true);

//   //     await instance.track('test');
      
//   //     await new Promise(resolve => setTimeout(resolve, 100));
//   //     expect(fetchSpy).not.toHaveBeenCalled();
      
//   //     // Clean up
//   //     delete (navigator as any).doNotTrack;
//   //     fetchSpy.mockRestore();
//   //   });
    
//   //   it('Plausible converts props to strings', () => {
//   //     // const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
//   //     //   new Response('ok', { status: 202 })
//   //     // );
      
//   //     const instance = plausibleProvider.create({
//   //       siteId: 'test.com',
//   //       trackLocalhost: true,
//   //     });
      
//   //     instance.track('test', {
//   //       string: 'value',
//   //       number: 123,
//   //       boolean: true,
//   //     });
      
//   //     const body = JSON.parse(fetchSpy.mock.calls[0][1].body || '');
//   //     expect(body.props).toEqual({
//   //       string: 'value',
//   //       number: '123',
//   //       boolean: 'true',
//   //     });
//   //   });
    
//   //   // // TODO: Resolve beacon failures
//   //   // it('GA4 manages session IDs', async () => {
//   //   //   const sendBeaconSpy = vi.fn().mockReturnValue(true);
//   //   //   Object.defineProperty(navigator, 'sendBeacon', {
//   //   //     value: sendBeaconSpy,
//   //   //     configurable: true,
//   //   //   });
      
//   //   //   const instance = ga4Provider.create({
//   //   //     siteId: 'G-TEST123456',
//   //   //   });
      
//   //   //   instance.track('event1');
//   //   //   instance.track('event2');
      
//   //   //   await new Promise(resolve => setTimeout(resolve, 100));
      
//   //   //   const payload1 = JSON.parse(await sendBeaconSpy.mock.calls[0][1].text());
//   //   //   const payload2 = JSON.parse(await sendBeaconSpy.mock.calls[1][1].text());
      
//   //   //   expect(payload1.events[0].params.session_id).toBe(
//   //   //     payload2.events[0].params.session_id
//   //   //   );
      
//   //   //   delete (navigator as any).sendBeacon;
//   //   // });
//   // });
  
//   // describe('Shared Functionality', () => {
//   //   it('all providers use shared browser utilities', async () => {
//   //     const { getBrowserData } = await import('../../../src/providers/shared/browser');
//   //     const browserDataSpy = vi.spyOn(
//   //       await import('../../../src/providers/shared/browser'),
//   //       'getBrowserData'
//   //     );
      
//   //     providers.forEach(({ factory, config }) => {
//   //       const instance = factory.create(config);
//   //       instance.track('test');
//   //     });
      
//   //     await new Promise(resolve => setTimeout(resolve, 100));
      
//   //     // Each provider should have called getBrowserData
//   //     expect(browserDataSpy).toHaveBeenCalled();
//   //   });
    
//   //   it('all providers use shared transport layer', async () => {
//   //     const transportSpy = vi.spyOn(
//   //       await import('../../../src/providers/shared/transport'),
//   //       'createTransport'
//   //     );
//   //     const sharedTransportProviders = ["umami", "plausible"];
//   //     providers.forEach(({ factory, config }) => {
//   //       factory.create(config);
//   //     });
      
//   //     // Each provider should have created a transport
//   //     expect(transportSpy).toHaveBeenCalledTimes(sharedTransportProviders.length);
//   //   });
//   // });
  
//   // describe('Integration with Facade', () => {
//   //   providers.forEach(({ name, config }) => {
//   //     it(`${name} integrates with facade consent`, () => {
//   //       init({...config, consent: { disablePersistence: true }});
        
//   //       // Start with pending consent
//   //       expect(getConsent()?.status).toBe('pending');
        
//   //       // Grant consent
//   //       grantConsent();
//   //       expect(getConsent()?.status).toBe('granted');
        
//   //       // Deny consent
//   //       denyConsent();
//   //       expect(getConsent()?.status).toBe('denied');
//   //     });
      
//   //     it(`${name} queues events when consent is pending`, async () => {
//   //       const instance = init(config);
        
//   //       // Track events while consent is pending
//   //       instance.track('queued_event');
        
//   //       const diagnostics = instance.getDiagnostics();
//   //       expect(diagnostics.facadeQueueSize).toBeGreaterThan(0);
//   //       expect(diagnostics.totalQueueSize).toBeGreaterThan(0);
        
//   //       // Grant consent should flush queue
//   //       grantConsent();
        
//   //       await new Promise(resolve => setTimeout(resolve, 100));
        
//   //       const diagnosticsAfter = instance.getDiagnostics();
//   //       expect(diagnosticsAfter.totalQueueSize).toBe(0);
//   //     });
//   //   });
//   // });
// });


// packages/trackkit/test/providers/comparison.test.ts
import { describe, it, expect } from 'vitest';
import { createFacade, createStatefulMock } from '../../helpers/providers';
import { grantConsent } from '../../../src';
import { navigate } from '../../helpers/navigation';

describe('Facade routes to active provider only', () => {
  it('swaps providers without double-sending', async () => {
    const { facade, provider } = await createFacade();
    grantConsent();

    // Attach A
    provider.pageviewCalls.length = 0; // ignore initial '/'

    await navigate('/a');
    console.warn('Pageview calls:', provider.pageviewCalls);

    const newMock = await createStatefulMock();

    expect(provider.pageviewCalls.map(c => c.url)).toEqual(['/a']);
    expect(newMock.provider.pageviewCalls.length).toBe(0);

    // Swap to B
    facade.setProvider(newMock.stateful);
    newMock.provider.pageviewCalls.length = 0; // ignore new initial '/'

    await navigate('/b');
    expect(newMock.provider.pageviewCalls.map(c => c.url)).toEqual(['/b']);
    expect(provider.pageviewCalls.map(c => c.url)).toEqual(['/a']); // unchanged
  });
});
