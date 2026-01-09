import React, { useEffect, useState } from 'react';
import { analytics } from './analytics';
import { ConsentBanner } from './ConsentBanner';

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Sync React state with browser URL changes (back/forward button)
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Simulate SPA Navigation
  const navigate = (path: string) => {
    // 1. Change browser URL
    window.history.pushState({}, '', path);
    // 2. Update local state to re-render UI
    setCurrentPath(path);
    
    // NOTE: We do NOT need to call analytics.pageview() here manually.
    // Trackkit's 'autoTrack: true' listens to pushState and handles it!
  };

  const handleSignupClick = () => {
    analytics.track('signup_clicked', { plan: 'pro', source: 'example-app' });
  };

  // Simple View Router
  const renderView = () => {
    switch (currentPath) {
      case '/pricing':
        return (
          <div>
            <h2>Pricing Page</h2>
            <p>This is a virtual page. Check your network tab!</p>
            <button onClick={handleSignupClick}>Pro Plan $10</button>
            <br /><br />
            <button onClick={() => navigate('/')}>Back to Home</button>
          </div>
        );
      case '/features':
        return (
          <div>
            <h2>Features Page</h2>
            <ul>
               <li>Auto-Tracking</li>
               <li>Privacy-First</li>
            </ul>
            <button onClick={() => navigate('/')}>Back to Home</button>
          </div>
        );
      default:
        return (
          <div>
             <h2>Home Page</h2>
             <p>Trackkit + Umami Demo</p>
             <button onClick={() => navigate('/pricing')}>Go to Pricing</button>
             {' '}
             <button onClick={() => navigate('/features')}>Go to Features</button>
          </div>
        );
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{currentPath === '/' ? 'Home' : currentPath}</h1>
      
      <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        {renderView()}
      </div>

      <section style={{ marginTop: '2rem', fontSize: '0.9em', color: '#666' }}>
        <h3>Diagnostics</h3>
        <p>
          Open the <strong>Network Tab</strong> and filter for <code>api/send</code> (Umami).
          Click the navigation buttons above to watch <strong>automatic pageview events</strong> fire 
          without manual code.
        </p>
      </section>

      <ConsentBanner />
    </main>
  );
}