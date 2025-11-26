import { sidebar } from './sidebar';

export default {
  title: 'Trackkit',
  description: 'Unified, privacy-first analytics SDK',

  base: '/trackkit/',

  themeConfig: {
    siteTitle: 'Trackkit',

    nav: [
      { text: 'Overview', link: '/overview/what-is-trackkit' },
      { text: 'Guides', link: '/guides/choosing-provider' },
      { text: 'Examples', link: '/examples/overview' },
      { text: 'Reference', link: '/reference/api' }
    ],

    sidebar,
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/enkosiventures/trackkit' },
      { icon: 'twitter', link: 'https://twitter.com/EnkosiVentures' },
      // {
      //   icon: {
      //     svg: '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><title>Enkosi Ventures Logo</title><path d="M150 5 L75 200 L225 200 Z" stroke="green" fill="green" /></svg>'
          
      //   },
      //   link: 'https://enkosiventures.com',
      //   ariaLabel: 'Enkosi Ventures'
      // }
    ],

    search: {
      provider: 'local'
    },

    cleanUrls: true,

    lastUpdated: true,

  }
};
