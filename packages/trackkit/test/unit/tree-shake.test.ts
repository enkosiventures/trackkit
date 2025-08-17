// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { rollup } from 'rollup';
import { minify } from 'terser';
import esbuild from 'rollup-plugin-esbuild';

describe('Tree-shaking', () => {
  it('allows importing individual methods', async () => {
    // Create a test entry that only imports track
    const bundle = await rollup({
      input: 'entry',
      plugins: [{
          name: 'virtual-entry',
          resolveId(id) {
            if (id === 'entry') return id;
          },
          load(id) {
            if (id === 'entry') {
              return `
                import track from './src/methods/track.js';
                track('test');
              `;
            }
          },
        },
        esbuild({ target: 'es2020' }),
      ],
    });
    
    const { output } = await bundle.generate({ format: 'esm' });
    
    const code = output[0].code;
    const minified = await minify(code, {
      compress: true,
      mangle: true,
    });
    
    // Verify unused methods are not in the bundle
    expect(minified.code).not.toMatch(/\\bpageview\\s*\\()/);
    expect(minified.code).not.toMatch(/\\bidentify\\s*\\()/);
  });
});