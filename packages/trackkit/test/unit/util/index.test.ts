import { describe, it, expect, vi, afterEach } from 'vitest';
import { deepClone, stripEmptyFields } from '../../../src/util';

const realSC: any = (globalThis as any).structuredClone;

describe('util.ts (extra)', () => {
  afterEach(() => {
    (globalThis as any).structuredClone = realSC;
    vi.restoreAllMocks();
  });

  it('deepClone uses structuredClone when available', () => {
    (globalThis as any).structuredClone = vi.fn((v: any) => ({ ...v, cloned: true }));
    const out = deepClone({ a: 1 });
    expect(out).toEqual({ a: 1, cloned: true });
  });

  it('deepClone falls back to JSON clone when structuredClone missing', () => {
    delete (globalThis as any).structuredClone;
    const src = { a: 1, b: { c: 2 } };
    const out = deepClone(src);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
  });

  it('deepClone last-resort shallow fallbacks when JSON fails (circular objects and arrays)', () => {
    delete (globalThis as any).structuredClone;
    const obj: any = { a: 1 }; obj.self = obj; // circular → JSON throws
    const arr: any[] = []; arr.push(arr);      // circular array

    const outObj = deepClone(obj);
    expect(outObj).not.toBe(obj);
    expect(outObj.a).toBe(1); // shallow copy

    const outArr = deepClone(arr);
    expect(outArr).not.toBe(arr);
    expect(Array.isArray(outArr)).toBe(true);
  });

  it('stripEmptyFields drops undefined/null/"" and empty objects/arrays, preserves non-plain objects', () => {
    const date = new Date();
    const input = {
      a: undefined,
      b: null,
      c: '',
      d: [],
      e: {},
      f: [1, null, '', 2, [], {}],
      g: { x: '', y: [], z: {} },
      h: date, // non-plain object should be preserved
      i: { k: 'ok', n: [[], { }, 'x'] },
    };

    const out = stripEmptyFields(input as any) as any;
    expect(out).toEqual({
      f: [1, 2, [], {}],
      h: date,
      i: { k: 'ok', n: [[], {}, 'x'] },
    });
  });
});
