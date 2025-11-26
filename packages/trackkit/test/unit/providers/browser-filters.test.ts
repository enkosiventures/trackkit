import { describe, it, expect } from 'vitest';
import { isUrlExcluded } from '../../../src/providers/browser';

describe('URL exclusion filters', () => {
  it('matches simple prefix and wildcard patterns', () => {
    const rules = ['/admin/*', '*/preview', '/metrics', '/files/*.zip'];
    expect(isUrlExcluded('/admin/panel', rules)).toBe(true);
    expect(isUrlExcluded('/blog/123/preview', rules)).toBe(true);
    expect(isUrlExcluded('/metrics', rules)).toBe(true);
    expect(isUrlExcluded('/files/build.zip', rules)).toBe(true);
    expect(isUrlExcluded('/files/build.tar.gz', rules)).toBe(false);
  });

  it('does not exclude unrelated paths', () => {
    const rules = ['/private/*'];
    expect(isUrlExcluded('/public/page', rules)).toBe(false);
  });
});
