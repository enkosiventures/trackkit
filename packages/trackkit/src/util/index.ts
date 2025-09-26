
// Prefer structuredClone when available (preserves Dates, Maps, etc.)
export function deepClone<T>(value: T): T {
  const sc: any = globalThis.structuredClone;
  if (typeof sc === 'function') {
    try { return sc(value); } catch { /* fall through */ }
  }
  // Fallback for plain JSON-able data
  try { return JSON.parse(JSON.stringify(value)) as T; }
  catch {
    // Last-resort shallow fallbacks
    if (Array.isArray(value)) return value.slice() as any;
    if (value && typeof value === 'object') return { ...(value as any) } as any;
    return value;
  }
}

export function stripEmptyFields<T>(input: T): T {
  // Primitives/null/undefined: return as-is
  if (input === null || input === undefined) return input;

  const t = typeof input;
  if (t !== 'object') return input;

  // Arrays: recurse into elements, keep as array, drop empty values
  if (Array.isArray(input)) {
    const cleaned = (input as unknown[]).map(stripEmptyFields)
      .filter((v) => v !== undefined && v !== null && v !== '');
    // (Optional) If you want to also drop empty objects inside arrays, uncomment:
    // .filter((v) => !(isPlainObject(v) && Object.keys(v as object).length === 0));
    return cleaned as unknown as T;
  }

  // Non-plain objects (Date, URL, Blob, Response, etc.): leave untouched
  if (!isPlainObject(input)) {
    return input;
  }

  // Plain objects: recurse into values, drop undefined/null/'' and optionally empty containers
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const cleaned = stripEmptyFields(v);

    // Drop explicit empties
    if (cleaned === undefined || cleaned === null || cleaned === '') continue;

    // Drop empty arrays/objects
    if (Array.isArray(cleaned) && cleaned.length === 0) continue;
    if (isPlainObject(cleaned) && Object.keys(cleaned as object).length === 0) continue;

    out[k] = cleaned;
  }
  return out as unknown as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
