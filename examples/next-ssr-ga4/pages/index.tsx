import { useState } from 'react';
import type { GetServerSideProps } from 'next';
import { ssrPageview, ssrTrack, getSSRQueue } from 'trackkit/ssr';
import { analytics } from '../lib/analytics';

type HomeProps = {
  url: string;
  serverEvents: any[]; // Pass server state to client for visualization
};

export const getServerSideProps: GetServerSideProps<HomeProps> = async (ctx) => {
  const url = ctx.resolvedUrl || '/';

  // 1. Generate Server Events
  ssrPageview(url);
  ssrTrack('server_data_prefetched', { source: 'cms', latency_ms: 45 });

  // 2. Capture them to display in the UI (purely for demo purposes)
  //    In a real app, _document takes care of the actual hydration transport.
  const serverEvents = JSON.parse(JSON.stringify(getSSRQueue() || []));

  return {
    props: {
      url,
      serverEvents,
    },
  };
};

export default function Home({ url, serverEvents }: HomeProps) {
  const [clientLog, setClientLog] = useState<string[]>([]);

  const handleTrack = () => {
    // Track event
    analytics?.track('signup_clicked', { plan: 'pro' });
    
    // Update local UI log
    setClientLog(prev => [`[Client] track: signup_clicked (${new Date().toLocaleTimeString()})`, ...prev]);
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Next.js SSR + GA4</h1>
      
      <p style={{ fontSize: '1.1em', lineHeight: '1.5' }}>
        This page was rendered on the server at <code>{url}</code>. <br/>
        Trackkit recorded events during the render, injected them into the HTML, 
        and the client SDK hydrated them automatically.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        
        {/* LEFT: Server Context */}
        <section style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}>Step 1: On the Server</h2>
          <p style={{ color: '#666', fontSize: '0.9em' }}>
            These events were generated in <code>getServerSideProps</code> and injected into <code>window.__TRACKKIT_SSR_QUEUE__</code>.
          </p>
          <ul style={{ background: 'white', border: '1px solid #ddd', padding: '1rem', listStyle: 'none', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.85em' }}>
            {serverEvents.map((evt, i) => (
              <li key={i} style={{ marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#d04255', fontWeight: 'bold' }}>[Server]</span> {evt.type}
                {evt.type === 'pageview' && <span style={{ color: '#666' }}> ({evt.args[0]})</span>}
                {evt.type === 'track' && <span style={{ color: '#666' }}> ({evt.args[0]})</span>}
              </li>
            ))}
          </ul>
        </section>

        {/* RIGHT: Client Context */}
        <section style={{ background: '#eef2ff', padding: '1.5rem', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}>Step 2: On the Client</h2>
          <p style={{ color: '#666', fontSize: '0.9em' }}>
            The app is now interactive. Click below to fire runtime events that merge with the SSR queue.
          </p>
          
          <button
            onClick={handleTrack}
            style={{
              padding: '0.5rem 1rem',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Track Event
          </button>

          {clientLog.length > 0 && (
            <ul style={{ marginTop: '1rem', background: 'white', border: '1px solid #c7d2fe', padding: '1rem', listStyle: 'none', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.85em' }}>
              {clientLog.map((msg, i) => (
                <li key={i} style={{ marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                  {msg}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p style={{ marginTop: '2rem', textAlign: 'center', color: '#666' }}>
        <em>Check the Network tab to see these batched together and sent to GA4.</em>
      </p>
    </main>
  );
}