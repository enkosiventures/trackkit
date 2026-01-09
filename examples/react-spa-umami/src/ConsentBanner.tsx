import React, { useEffect, useState } from 'react';
import { analytics } from './analytics';

export function ConsentBanner() {
  // 1. Initialize logic based on current state
  const [isVisible, setIsVisible] = useState(() => analytics.getConsent() === 'pending');

  useEffect(() => {
    // 2. Subscribe to changes. This handles UI updates for both
    //    user clicks AND programmatic changes (e.g. from tests)
    const unsubscribe = analytics.onConsentChange((status) => {
      setIsVisible(status === 'pending');
    });
    return unsubscribe;
  }, []);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#333',
      color: 'white',
      padding: '1rem 2rem',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
      zIndex: 100
    }}>
      <span>
        We use privacy-first analytics. 
        <br/>
        <small style={{ opacity: 0.8 }}>Events are currently queued locally.</small>
      </span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button 
          onClick={() => analytics.denyConsent()}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: 'transparent', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
        >
          Decline
        </button>
        <button 
          onClick={() => analytics.grantConsent()}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: 'white', color: '#333', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}