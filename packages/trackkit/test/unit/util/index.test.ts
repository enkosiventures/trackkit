import { describe, it, expect, vi, afterEach } from 'vitest';
import { deepClone, deepMerge, stripEmptyFields } from '../../../src/util';

const realSC: any = (globalThis as any).structuredClone;

describe('deepClone', () => {
  afterEach(() => {
    (globalThis as any).structuredClone = realSC;
    vi.restoreAllMocks();
  });

  it('uses structuredClone when available', () => {
    (globalThis as any).structuredClone = vi.fn((v: any) => ({ ...v, cloned: true }));
    const out = deepClone({ a: 1 });
    expect(out).toEqual({ a: 1, cloned: true });
  });

  it('falls back to JSON clone when structuredClone missing', () => {
    delete (globalThis as any).structuredClone;
    const src = { a: 1, b: { c: 2 } };
    const out = deepClone(src);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
  });

  it('last-resort shallow fallbacks when JSON fails (circular objects and arrays)', () => {
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
});

describe('stripEmptyFields', () => {
  it('drops undefined/null/"" and empty objects/arrays, preserves non-plain objects', () => {
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

describe('deepMerge', () => {
  type TestType = {
    a: number;
    nested: {
      x?: number;
      y?: number;
      z?: number;
    };
  };
  
  it('returns empty object when both base and override are undefined', () => {
    const result = deepMerge(undefined as any, undefined as any);
    expect(result).toEqual({});
  });

  it('returns a shallow clone of base when override is undefined', () => {
    const base = { a: 1, nested: { x: 1 } };
    const result = deepMerge(base, undefined);

    // Value equality
    expect(result).toEqual(base);
    // Not the same reference
    expect(result).not.toBe(base);
    // Nested object also cloned (because of spread)
    expect(result.nested).not.toBe(base.nested);
  });

  it('returns a shallow clone of override when base is undefined', () => {
    const override = { a: 1, nested: { x: 1 } };
    const result = deepMerge(undefined as any, override);

    expect(result).toEqual(override);
    expect(result).not.toBe(override);
    expect(result.nested).not.toBe(override.nested);
  });

  it('overrides primitive values from override', () => {
    const base = { a: 1, b: 'base', c: false };
    const override = { a: 2, b: 'override', c: true };

    const result = deepMerge(base, override);

    expect(result).toEqual({ a: 2, b: 'override', c: true });
  });

  it('does not clobber base keys when override contains undefined', () => {
    const base = { a: 1, b: 2 };
    const override = { a: undefined, b: 3 };

    const result = deepMerge(base, override);

    // a should remain from base; b should be overridden
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it('merges nested plain objects recursively', () => {
    const base = {
      a: 1,
      nested: {
        x: 1,
        y: 2,
      },
    };

    const override = {
      nested: {
        y: 42,
        z: 99,
      },
    };

    const result = deepMerge<TestType>(base, override);

    expect(result).toEqual({
      a: 1,
      nested: {
        x: 1,      // from base
        y: 42,     // overridden
        z: 99,     // added
      },
    });

    // Ensure nested object is a new object (no mutation)
    expect(result.nested).not.toBe(base.nested);
  });

  it('replaces arrays instead of merging them element-wise', () => {
    const base = {
      list: [1, 2, 3],
      nested: { list: ['a', 'b'] },
    };

    const override = {
      list: [4, 5],
      nested: { list: ['c'] },
    };

    const result = deepMerge(base, override);

    expect(result).toEqual({
      list: [4, 5],
      nested: { list: ['c'] },
    });

    // Sanity check: no accidental reference reuse
    expect(result.list).not.toBe(base.list);
    expect(result.nested.list).not.toBe(base.nested.list);
  });

  it('treats non-plain objects (like Date) as atomic values', () => {
    const baseDate = new Date('2020-01-01T00:00:00.000Z');
    const overrideDate = new Date('2021-01-01T00:00:00.000Z');

    const base = {
      createdAt: baseDate,
      nested: {
        updatedAt: baseDate,
      },
    };

    const override = {
      createdAt: overrideDate,
      nested: {
        updatedAt: overrideDate,
      },
    };

    const result = deepMerge(base, override);

    // Values overridden
    expect(result.createdAt).toBe(overrideDate);
    expect(result.nested.updatedAt).toBe(overrideDate);

    // And the nested Date was not deep-merged (it was just replaced)
    expect(result.createdAt).not.toBe(baseDate);
    expect(result.nested.updatedAt).not.toBe(baseDate);
  });

  it('treats class instances as atomic values (no recursive merge)', () => {
    class Box {
      constructor(public value: number) {}
    }

    const base = {
      box: new Box(1),
    };

    const override = {
      box: new Box(2),
    };

    const result = deepMerge(base, override);

    expect(result.box).toBeInstanceOf(Box);
    expect(result.box.value).toBe(2);
    expect(result.box).not.toBe(base.box);
  });

  it('merges objects with null prototype as plain objects', () => {
    const base = Object.create(null) as Record<string, unknown>;
    base.a = 1;
    base.nested = { x: 1 };

    const override = Object.create(null) as Record<string, unknown>;
    override.b = 2;
    override.nested = { y: 2 };

    const result = deepMerge(base, override);

    // Basic shape
    expect(result).toEqual({
      a: 1,
      b: 2,
      nested: { x: 1, y: 2 },
    });

    // Ensure nested was deep-merged, not replaced
    expect((result as any).nested).not.toBe(base.nested);
    expect((result as any).nested).not.toBe(override.nested);
  });

  it('does not mutate base or override objects (shallow immutability)', () => {
    const base = {
      a: 1,
      nested: { x: 1 },
    };

    const override = {
      a: 2,
      nested: { y: 2 },
    };

    const baseClone = structuredClone(base);
    const overrideClone = structuredClone(override);

    const result = deepMerge<TestType>(base, override);

    // Result is as expected
    expect(result).toEqual({
      a: 2,
      nested: { x: 1, y: 2 },
    });

    // Inputs remain unchanged
    expect(base).toEqual(baseClone);
    expect(override).toEqual(overrideClone);
  });

  it('handles mixed objects, arrays, and primitives in nested structures correctly', () => {
    type ComplexTestType = {
      a: number;
      nested: {
        simple: boolean;
        obj: {
          x?: number;
          y: number;
          z?: number;
        };
        list: number[];
      };
    };

    const base = {
      a: 1,
      nested: {
        simple: true,
        obj: { x: 1, y: 2 },
        list: [1, 2, 3],
      },
    };

    const override = {
      nested: {
        simple: false,
        obj: { y: 99 },
        list: [4, 5],
      },
    };

    const result = deepMerge<ComplexTestType>(base, override);

    expect(result).toEqual({
      a: 1,
      nested: {
        simple: false,         // overridden primitive
        obj: { x: 1, y: 99 },  // deep-merged object
        list: [4, 5],          // array replaced wholesale
      },
    });
  });
});
