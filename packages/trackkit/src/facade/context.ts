import type { PageContext } from '../types';
import { getPageContext } from '../providers/browser';
import type { FacadeOptions } from '../types';

export class ContextService {
  private lastPlannedUrl: string | null = null;
  private lastSentUrl: string | null = null;
  constructor(private cfg: FacadeOptions) {}

  normalizeUrl(url: string): string {
    let out = url ?? '/';
    if (!this.cfg?.includeHash) out = out.replace(/#.*$/, '');
    if (this.cfg?.urlTransform) out = this.cfg.urlTransform(out);
    return out;
  }

  resolveCurrentUrl(): string {
    if (this.cfg?.urlResolver) return this.cfg.urlResolver();
    if (typeof window === 'undefined') return '/';
    return window.location.pathname + window.location.search + window.location.hash;
  }

  normalizeReferrer(ref: string): string {
    if (!ref) return '';
    if (typeof window === 'undefined') return ref;
    try {
      const url = new URL(ref, window.location.origin);
      if (url.origin === window.location.origin) {
        return this.normalizeUrl(url.pathname + url.search + url.hash);
      }
      return ref;
    } catch {
      return this.normalizeUrl(ref);
    }
  }

  buildPageContext(url: string, userId?: string | null): PageContext {
    const ref = this.lastSentUrl === null
      ? (typeof document !== 'undefined' ? this.normalizeReferrer(document.referrer) : '')
      : this.lastSentUrl;
    return { ...getPageContext(url), userId: userId || undefined, referrer: ref };
  }

  isDuplicatePageview(url: string): boolean {
    return this.lastPlannedUrl === url;
  }

  getLastPlannedUrl() { return this.lastPlannedUrl; }
  getLastSentUrl() { return this.lastSentUrl; }
  markPlanned(url: string) { this.lastPlannedUrl = url; }
  markSent(url: string) { this.lastPlannedUrl = url; this.lastSentUrl = url; }
  reset() { this.lastPlannedUrl = null; this.lastSentUrl = null; }
}