import { describe, it, expect, afterEach } from 'vitest';
import { ContextService } from '../../../src/facade/context';

const realWindow = globalThis.window as any;
const realDocument = (globalThis as any).document;

function mkCtx(overrides: any = {}) {
  return new ContextService({
    includeHash: false,
    urlTransform: (u: string) => u,
    ...overrides,
  } as any);
}

describe('context.ts (extra)', () => {
  afterEach(() => {
    (globalThis as any).window = realWindow;
    (globalThis as any).document = realDocument;
  });

  it('normalizeReferrer: same-origin vs cross-origin vs invalid', () => {
    (globalThis as any).window = { location: { origin: 'https://example.com' } };
    const ctx = mkCtx({ includeHash: false });

    const same = ctx.normalizeReferrer('https://example.com/p?a=1#h');
    expect(same).toBe('/p?a=1');

    const other = ctx.normalizeReferrer('https://other.com/p?q=2#h');
    expect(other).toBe('https://other.com/p?q=2#h');

    // Invalid ref → your impl percent-encodes & prefixes with "/"
    const invalid = ctx.normalizeReferrer('not a url #h');
    expect(invalid).toBe('/' + encodeURI('not a url '));
  });

  it('resolveCurrentUrl: uses custom resolver if provided; SSR returns "/"', () => {
    const ctxA = mkCtx({ urlResolver: () => '/custom' });
    expect(ctxA.resolveCurrentUrl()).toBe('/custom');

    delete (globalThis as any).window;
    const ctxB = mkCtx();
    expect(ctxB.resolveCurrentUrl()).toBe('/');
  });

  it('buildPageContext: first PV uses document.referrer; subsequent PVs use lastSentUrl', () => {
    (globalThis as any).document = { referrer: 'https://ref.example/x' };
    (globalThis as any).window = { location: { origin: 'https://example.com' } };

    const ctx = mkCtx();
    // First call: lastSentUrl is null -> uses document.referrer (normalized)
    const a = ctx.buildPageContext('/a', null);
    expect(a.referrer).toBe('https://ref.example/x'); // cross-origin unchanged

    // After marking sent, next uses lastSentUrl
    ctx.markSent('/a');
    const b = ctx.buildPageContext('/b', 'u1');
    expect(b.referrer).toBe('/a');
    expect(b.userId).toBe('u1');
  });
});
