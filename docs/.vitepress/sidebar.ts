import type { DefaultTheme } from 'vitepress';

export const sidebar: DefaultTheme.Sidebar = {
  '/overview/': [
    {
      text: 'Overview',
      collapsed: false,
      items: [
        { text: 'What is Trackkit?', link: '/overview/what-is-trackkit' },
        { text: 'Quickstart', link: '/overview/quickstart' },
        { text: 'Playground', link: '/overview/playground' },
        { text: 'Architecture', link: '/overview/architecture' },
        { text: 'FAQ', link: '/overview/faq' }
      ]
    }
  ],

  '/guides/': [
    {
      text: 'Guides',
      collapsed: false,
      items: [
        { text: 'Providers', items: [
          { text: 'Choosing a Provider', link: '/guides/choosing-provider' },
          { text: 'Built-in Providers', collapsed: true, items: [
            { text: 'Umami', link: '/providers/umami' },
            { text: 'Plausible', link: '/providers/plausible' },
            { text: 'GA4', link: '/providers/ga4' }
          ] },
          { text: 'Migrating to Trackkit', collapsed: true, items: [
            { text: 'From Umami', link: '/migration/from-umami' },
            { text: 'From Plausible', link: '/migration/from-plausible' },
            { text: 'From GA4', link: '/migration/from-ga4' },
            { text: 'From Env Vars', link: '/migration/from-env-vars' }
          ] },
          { text: 'Custom Providers', link: '/guides/custom-providers' }
        ]},
        { text: 'Core Concepts', items: [
          { text: 'Consent & Privacy', link: '/guides/consent-and-privacy' },
          { text: 'Consent Management', link: '/guides/consent-management' },
          { text: 'Queue Management', link: '/guides/queue-management' },
          { text: 'State Management', link: '/guides/state-management' },
          { text: 'Server Side Rendering', link: '/guides/ssr' },
          { text: 'Debugging & Diagnostics', link: '/guides/debugging-and-diagnostics' }
        ] },
        { text: 'Advanced Topics', items: [
          { text: 'Connection & Offline', link: '/guides/connection-and-offline' },
          { text: 'Resilience & Transports', link: '/guides/resilience-and-transports' },
          { text: 'Navigation & Autotrack', link: '/guides/navigation-autotrack' },
          { text: 'Performance Tracking', link: '/guides/performance-tracking' },
          { text: 'Content Security Policy', link: '/guides/csp' }
        ] }
      ]
    }
  ],

  '/examples/': [
    {
      text: 'Examples',
      items: [
        { text: 'Overview', link: '/examples/overview' },
        { text: 'React SPA + Umami', link: '/examples/react-spa-umami' },
        { text: 'Next.js (SSR) + GA4', link: '/examples/next-ssr-ga4' },
      ]
    }
  ],

  '/reference/': [
    {
      text: 'Reference',
      items: [
        { text: 'Configuration', link: '/reference/configuration' },
        { text: 'Error Codes', link: '/reference/error-codes' },
        { text: 'Providers', link: '/reference/providers' },
        { text: 'Glossary', link: '/reference/glossary' },
        { text: 'API', collapsed: false, items: [
          { text: 'Public API Overview', link: '/reference/api' },
          { text: 'SDK (TypeDoc) Reference', link: '/reference/sdk/README' }
        ] },
      ]
    }
  ],

  // fallback for root paths
  '/': [
    {
      text: 'Overview',
      items: [
        { text: 'What is Trackkit?', link: '/overview/what-is-trackkit' },
        { text: 'Quickstart', link: '/overview/quickstart' },
        { text: 'Playground', link: '/overview/playground' },
        { text: 'Architecture', link: '/overview/architecture' },
        { text: 'FAQ', link: '/overview/faq' }
      ]
    }
  ]
};
