#!/usr/bin/env node
import { analyzeMetafile } from 'esbuild';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const metafile = join(__dirname, '../packages/trackkit/dist/metafile.json');

try {
  const meta = JSON.parse(await readFile(metafile, 'utf-8'));
  const analysis = await analyzeMetafile(meta, {
    verbose: true,
  });
  
  console.log('Bundle Analysis:');
  console.log(analysis);
  
  // Check Umami adapter size
  const outputs = Object.entries(meta.outputs);
  const umamiSize = outputs
    .filter(([name]) => name.includes('umami'))
    .reduce((total, [, data]) => total + data.bytes, 0);
  
  console.log(`\nUmami adapter size: ${(umamiSize / 1024).toFixed(2)} KB`);
  
  if (umamiSize > 1536) { // 1.5 KB in bytes
    console.error('❌ Umami adapter exceeds 1.5 KB limit');
    process.exit(1);
  }
  
} catch (error) {
  console.error('Failed to analyze bundle:', error);
  process.exit(1);
}