const KEY = Symbol.for('trackkit.navigationSandbox');

type NavCb = (url: string) => void;

export function ensureNavigationSandbox(win: Window = window) {
  const globalAny = win as any;
  if (globalAny[KEY]) return globalAny[KEY] as NavigationSandbox;

  const subs = new Set<NavCb>();
  const orig = {
    push: win.history.pushState,
    replace: win.history.replaceState,
  };

  const dispatch = () => {
    const url = win.location.pathname + win.location.search + win.location.hash;
    subs.forEach(cb => cb(url));
  };

  // Patch once
  win.history.pushState = new Proxy(orig.push, {
    apply(target, thisArg, args) {
      const ret = Reflect.apply(target, thisArg, args);
      queueMicrotask(dispatch);
      return ret;
    },
  });

  win.history.replaceState = new Proxy(orig.replace, {
    apply(target, thisArg, args) {
      const ret = Reflect.apply(target, thisArg, args);
      queueMicrotask(dispatch);
      return ret;
    },
  });

  const onPop = () => dispatch();
  win.addEventListener('popstate', onPop);

  const restore = () => {
    win.history.pushState = orig.push;
    win.history.replaceState = orig.replace;
    win.removeEventListener('popstate', onPop);
    subs.clear();
  };

  const api: NavigationSandbox = {
    subscribe(cb: NavCb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
        if (subs.size === 0) {
          restore();
          delete globalAny[KEY];
        }
      };
    },
    __reset() { restore(); delete globalAny[KEY]; },
  };

  globalAny[KEY] = api;
  return api;
}

export type NavigationSandbox = {
  subscribe(cb: NavCb): () => void;
  /** test-only */
  __reset(): void;
};
