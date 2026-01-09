import { createAnalytics } from 'trackkit';

export const analytics = createAnalytics({
  provider: {
    name: 'umami',
    site: import.meta.env.VITE_UMAMI_SITE,
    host: import.meta.env.VITE_UMAMI_HOST,
  },
  autoTrack: true,            // Enable auto-tracking of page views and events
  trackLocalhost: true,       // Allow localhost tracking for demo purposes
  debug: import.meta.env.DEV, // Log debug messages to console in development
  doNotTrack: false,          // Ignore DNT for demo purposes
  consent: {
    initialStatus: 'pending', // Events will be queued
    requireExplicit: true,    // Prevent auto-grant
  },
});