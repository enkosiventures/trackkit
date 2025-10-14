import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',

    'providers/umami': 'src/entries/providers/umami.ts',
    'providers/plausible': 'src/entries/providers/plausible.ts',
    'providers/ga4': 'src/entries/providers/ga4.ts',
  },
  format: ['esm', 'cjs'],
  dts: false,
  splitting: true,
  treeshake: true,
  minify: true,
  sourcemap: true,
  target: 'es2019',
  clean: true,
  tsconfig: 'tsconfig.build.json',
  esbuildOptions(opts) {
    // Keep directory structure for entry outputs
    // so dist/providers/*.js are emitted (not flattened).
    // Use the source path after this outbase:
    opts.outbase = 'src/entries';
    // Place each entry under its relative dir from outbase:
    // e.g. providers/umami.ts -> dist/providers/umami.js
    opts.entryNames = '[dir]/[name]';
    // put shared chunks under a folder (optional)
    opts.chunkNames = 'chunks/[hash]';

    // help DCE drop debug in production
    (opts as any).pure = ['logger.debug', 'logger.info', 'debugLog'];
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
