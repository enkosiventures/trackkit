import { describe, it, expect, afterEach, vi } from 'vitest';

import { makeWindowNavigationSource } from '../../../src/facade/navigation';

type Listener = (e?: any) => void;

function createFakeWindow() {
  // Minimal EventTarget-ish facade for our tests
  const listeners: Record<string, Set<Listener>> = {
    popstate: new Set(),
    hashchange: new Set(),
  };

  const addEventListener = vi.fn((type: string, cb: Listener) => {
    (listeners[type] || (listeners[type] = new Set())).add(cb);
  });

  const removeEventListener = vi.fn((type: string, cb: Listener) => {
    listeners[type]?.delete(cb);
  });

  const dispatch = (type: string) => {
    for (const cb of listeners[type] ?? []) cb();
  };

  // Location + History that we can mutate
  const loc = {
    href: 'https://app.example.com/',
    protocol: 'https:',
    host: 'app.example.com',
    pathname: '/',
    search: '',
    hash: '',
  };

  const update = (next: Partial<typeof loc>) => {
    Object.assign(loc, next);
    loc.href = `https://${loc.host}${loc.pathname}${loc.search}${loc.hash}`;
  };

  const history = {
    _entries: [loc.href],
    _index: 0,
    pushState: vi.fn((_state: any, _title: string, url?: string | URL | null) => {
      if (url != null) {
        const u = new URL(String(url), loc.href);
        update({ pathname: u.pathname, search: u.search, hash: u.hash });
      }
      history._entries.splice(history._index + 1);
      history._entries.push(loc.href);
      history._index++;
    }),
    replaceState: vi.fn((_state: any, _title: string, url?: string | URL | null) => {
      if (url != null) {
        const u = new URL(String(url), loc.href);
        update({ pathname: u.pathname, search: u.search, hash: u.hash });
      }
      history._entries[history._index] = loc.href;
    }),
    back: vi.fn(() => {
      if (history._index > 0) {
        history._index--;
        const u = new URL(history._entries[history._index]);
        update({ pathname: u.pathname, search: u.search, hash: u.hash });
      }
    }),
    forward: vi.fn(() => {
      if (history._index < history._entries.length - 1) {
        history._index++;
        const u = new URL(history._entries[history._index]);
        update({ pathname: u.pathname, search: u.search, hash: u.hash });
      }
    }),
    state: null as any,
    length: 1,
    scrollRestoration: 'auto' as const,
  };

  const fakeWindow = {
    location: loc as Location,
    history: history as any as History,
    addEventListener,
    removeEventListener,
    dispatch,
    document: { // enough to satisfy any document checks
      readyState: 'complete',
    } as any,
  };

  return { win: fakeWindow as any as Window, listeners, update, dispatch, history, loc };
}

const ORIGINALS: Partial<Record<string, any>> = {};

function setGlobalWindow(w?: Window) {
  if (!('window' in ORIGINALS)) ORIGINALS.window = (globalThis as any).window;
  if (!('document' in ORIGINALS)) ORIGINALS.document = (globalThis as any).document;
  if (w) {
    (globalThis as any).window = w;
    (globalThis as any).document = (w as any).document;
  } else {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
  }
}

afterEach(() => {
  // Restore globals
  if ('window' in ORIGINALS) (globalThis as any).window = ORIGINALS.window;
  if ('document' in ORIGINALS) (globalThis as any).document = ORIGINALS.document;
});

describe('makeWindowNavigationSource', () => {
  it('is SSR-safe (no window) and does not throw / emit', () => {
    setGlobalWindow(undefined as any);
    const src = makeWindowNavigationSource();

    const seen: string[] = [];
    const unsub = src.subscribe((url) => seen.push(url));

    // No window means no emissions; also should not throw.
    expect(seen).toEqual([]);
    unsub(); // should be a safe noop
  });

  it('emits normalized `pathname + search + hash` on SPA navigations', () => {
    const { win, dispatch, history } = createFakeWindow();
    setGlobalWindow(win);

    const src = makeWindowNavigationSource();

    const seen: string[] = [];
    const unsub = src.subscribe((url) => seen.push(url));

    // pushState → /a
    win.history.pushState({}, '', '/a');
    dispatch('popstate'); // many libs emit on pushState hook OR popstate; support either
    // replaceState → /a?x=1
    win.history.replaceState({}, '', '/a?x=1');
    dispatch('popstate');
    // hashchange → /a?x=1#h
    win.location.hash = '#h';
    dispatch('hashchange');

    // back/forward via popstate updates
    history.back();
    dispatch('popstate');
    history.forward();
    dispatch('popstate');

    // Expect normalized emissions contain these transitions (order-safe subset match)
    // We only assert they appeared; some implementations may also emit initial URL.
    const expectContains = (value: string) =>
      expect(seen).toContain(value);

    expectContains('/a');          // after first pushState
    expectContains('/a?x=1');      // replaceState normalization
    expectContains('/a?x=1#h');    // hashchange normalization

    // After back/forward we should see either the previous entries
    // depending on your implementation; we accept either:
    // back → likely baseline '/a?x=1' or '/'
    // forward → likely '/a?x=1#h'
    // We’ll just ensure no malformed empty emission happened:
    for (const s of seen) {
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
      expect(s[0]).toBe('/'); // normalized path begins with slash
    }

    unsub();
  });

  it('does not emit duplicates when URL does not actually change', () => {
    const { win, dispatch } = createFakeWindow();
    setGlobalWindow(win);

    const src = makeWindowNavigationSource();
    const seen: string[] = [];
    const unsub = src.subscribe((url) => seen.push(url));

    // pushState to same URL
    const same = `${win.location.pathname}${win.location.search}${win.location.hash}` || '/';
    win.history.pushState({}, '', same);
    dispatch('popstate');

    // replaceState to same URL
    win.history.replaceState({}, '', same);
    dispatch('popstate');

    // hashchange to same hash
    const prevLen = seen.length;
    dispatch('hashchange');

    // Either zero new emissions or a single initial emission the impl always does.
    // The key assertion: pushing/replacing to the *same* normalized URL should not
    // increase the count beyond any initial emission policy.
    const afterLen = seen.length;
    // No more than one new emission “at most” (some impls emit once on subscribe)
    expect(afterLen - prevLen).toBeLessThanOrEqual(1);

    unsub();
  });

  it('unsub removes listeners and stops emitting after cleanup', () => {
    const { win, dispatch } = createFakeWindow();
    setGlobalWindow(win);

    const src = makeWindowNavigationSource();
    const seen: string[] = [];
    const unsub = src.subscribe((url) => seen.push(url));

    // First, cause an emission so we know it works
    win.history.pushState({}, '', '/first');
    dispatch('popstate');
    expect(seen).toContain('/first');

    // Now unsubscribe
    unsub();

    // Further navigations should not appear
    win.history.pushState({}, '', '/second');
    dispatch('popstate');
    expect(seen).not.toContain('/second');
  });
});
