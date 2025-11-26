import { expect, it } from 'vitest';

it('provider subpath resolves from dist', async () => {
  const ga4 = await import('../../dist/providers/ga4.js');
  expect(ga4).toBeTruthy();
  expect(ga4.default).toBeDefined();
});
