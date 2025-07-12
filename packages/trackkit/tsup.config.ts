import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false, // Will be enabled in production builds
  splitting: false,
  treeshake: true,
  target: 'es2020',
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.js' : '.cjs',
      dts: format === 'esm' ? '.d.ts' : '.d.cts',
    };
  },
  esbuildOptions(options) {
    options.banner = {
      js: '/*! Trackkit - Lightweight Analytics SDK */',
    };
  },
});