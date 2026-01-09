import { createAnalytics } from 'trackkit';

const isBrowser = typeof window !== 'undefined';

export const analytics = isBrowser
  ? createAnalytics({
      provider: {
        name: 'ga4',
        site: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
      },
      autoTrack: true,
      debug: process.env.NODE_ENV !== 'production',
      doNotTrack: false,
      trackLocalhost: true,
      consent: {
        initialStatus: 'granted', // Events will be queued
      },
      dispatcher: {
        resilience: { detectBlockers: true },
      },
    })
  : null;
