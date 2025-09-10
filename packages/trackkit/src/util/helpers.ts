
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