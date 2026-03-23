import { sidebar } from './sidebar';
import { resolve } from 'node:path'

const siteUrl = 'https://trackkit.enkosiventures.com'
const siteDescription = 'Privacy-first analytics SDK for modern web apps. Queue-first runtime with consent gating, SSR support, and adapters for Umami, Plausible, and GA4.'

export default {
  title: 'Trackkit',
  titleTemplate: ':title | Trackkit',
  description: siteDescription,

  base: '/',

  cleanUrls: true,
  lastUpdated: true,

  // Trailing slash is required: VitePress passes hostname to new URL(path, hostname).
  // Without it, URL resolution drops the last path segment.
  sitemap: {
    hostname: `${siteUrl}/`,
  },

  head: [
    ['meta', { property: 'og:site_name', content: 'Trackkit' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: `${siteUrl}/og-image.png` }],
    ['meta', { property: 'og:url', content: siteUrl }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}/og-image.png` }],
    ['meta', { name: 'twitter:site', content: '@EnkosiVentures' }],
  ],

  transformPageData(pageData: any) {
    // Set canonical URL for every page
    const canonicalUrl = `${siteUrl}/${pageData.relativePath}`
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '')
    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push([
      'link',
      { rel: 'canonical', href: canonicalUrl },
    ])
  },

  vite: {
    resolve: {
      alias: [
        // top-level API
        { find: 'trackkit', replacement: resolve(__dirname, '../../packages/trackkit/src/index.ts') },
        // (optional) subpath imports like 'trackkit/providers/...'
        { find: /^trackkit\/(.*)$/, replacement: resolve(__dirname, '../../packages/trackkit/src/$1') },
      ],
    },
    server: {
      fs: { allow: [resolve(__dirname, '../../')] }, // allow reading the monorepo
    },
    optimizeDeps: { exclude: ['trackkit'] },
  },

  themeConfig: {
    siteTitle: 'Trackkit',

    nav: [
      { text: 'Overview', link: '/overview/what-is-trackkit' },
      { text: 'Guides', link: '/guides/choosing-provider' },
      { text: 'Examples', link: '/examples/overview' },
      { text: 'Reference', link: '/reference/configuration' }
    ],

    sidebar,
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/enkosiventures/trackkit' },
      { icon: 'twitter', link: 'https://twitter.com/EnkosiVentures' },
    ],

    search: {
      provider: 'local'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: '© Enkosi Ventures',
    },

  }
};
