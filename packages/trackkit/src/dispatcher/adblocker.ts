export type BlockerDetection = { blocked: boolean; method?: 'fetch'|'script'|'dns'|'unknown'; confidence: number; fallback?: 'proxy'|'beacon'|'none'; };

export async function detectBlockers(): Promise<BlockerDetection> {
  const results: BlockerDetection[] = await Promise.all([
    checkScript(), checkFetch(), checkDNS()
  ]);
  const blocked = results.some(r => r.blocked);
  const confidence = Math.max(...results.map(r => r.confidence));
  const method = results.find(r => r.blocked)?.method || 'unknown';
  return { blocked, method, confidence, fallback: blocked ? (method === 'dns' ? 'beacon' : 'proxy') : undefined };
}

function checkFetch(): Promise<BlockerDetection> {
  // SSR-safe: if fetch is absent, we cannot meaningfully probe; return neutral
  if (typeof fetch === 'undefined') {
    return Promise.resolve({ blocked: false, confidence: 0 });
  }
  return new Promise(resolve => {
    const ctrl = new AbortController();
    const t = setTimeout(() => { ctrl.abort(); resolve({ blocked: true, method: 'fetch', confidence: 0.7 }); }, 1000);
    fetch('https://www.google-analytics.com/g/debug', { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal })
      .then(() => { clearTimeout(t); resolve({ blocked: false, confidence: 0.8 }); })
      .catch(() => { clearTimeout(t); resolve({ blocked: true, method: 'fetch', confidence: 0.7 }); });
  });
}

function safeRemove(node: any) {
  try {
    if (node && typeof node.remove === 'function') {
      node.remove();
    } else if (node?.parentNode && typeof node.parentNode.removeChild === 'function') {
      node.parentNode.removeChild(node);
    }
  } catch {
    // swallow – removal is best-effort in detection code
  }
}

function checkScript(): Promise<BlockerDetection> {
  if (typeof document === 'undefined') return Promise.resolve({ blocked: false, confidence: 0 });
  return new Promise(resolve => {
    const s = document.createElement('script');
    const t = setTimeout(() => { safeRemove(s); resolve({ blocked: true, method: 'script', confidence: 0.8 }); }, 1000);
    s.src = 'https://www.google-analytics.com/analytics.js';
    s.async = true;
    s.onload = () => { clearTimeout(t); safeRemove(s); resolve({ blocked: false, confidence: 0.9 }); };
    s.onerror = () => { clearTimeout(t); safeRemove(s); resolve({ blocked: true, method: 'script', confidence: 0.9 }); };
    document.head.appendChild(s);
  });
}

function checkDNS(): Promise<BlockerDetection> {
  // SSR-safe: no Image constructor in non-DOM environments
  if (typeof Image === 'undefined') {
    return Promise.resolve({ blocked: false, confidence: 0 });
  }
  return new Promise(resolve => {
    const img = new Image();
    const t = setTimeout(() => resolve({ blocked: true, method: 'dns', confidence: 0.6 }), 1000);
    img.onload = () => { clearTimeout(t); resolve({ blocked: false, confidence: 0.7 }); };
    img.onerror = () => { clearTimeout(t); resolve({ blocked: true, method: 'dns', confidence: 0.7 }); };
    img.src = 'https://www.google-analytics.com/favicon.ico';
  });
}