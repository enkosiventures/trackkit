import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { analytics } from '../lib/analytics';

export default function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Debug helper – not recommended in real apps
    if (typeof window !== 'undefined') {
      (window as any).__analytics = analytics;
    }
  }, []);

  return <Component {...pageProps} />;
}
