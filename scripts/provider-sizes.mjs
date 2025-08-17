#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { join } from 'path';
import { gzipSync } from 'zlib';

const providers = ['noop', 'umami', 'plausible', 'ga'];

console.log('Provider Bundle Sizes\n');
console.log('| Provider | Size (min) | Size (gzip) |');
console.log('|----------|------------|-------------|');

for (const provider of providers) {
  try {
    // Build provider module
    const modulePath = join('dist', 'providers', provider, 'index.js');
    const content = await readFile(modulePath, 'utf-8');
    
    const minSize = Buffer.byteLength(content);
    const gzipSize = gzipSync(content).length;
    
    console.log(
      `| ${provider.padEnd(8)} | ${(minSize / 1024).toFixed(2)} KB | ${(gzipSize / 1024).toFixed(2)} KB |`
    );
  } catch (error) {
    console.error(`Failed to analyze ${provider}:`, error.message);
  }
}