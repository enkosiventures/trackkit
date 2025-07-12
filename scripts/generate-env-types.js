#!/usr/bin/env node
/**
 * Generates TypeScript types for environment variables
 * Run during build to ensure type safety
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envVars = [
  'TRACKKIT_PROVIDER',
  'TRACKKIT_SITE_ID',
  'TRACKKIT_HOST',
  'TRACKKIT_QUEUE_SIZE',
  'TRACKKIT_DEBUG',
];

const viteVars = envVars.map(v => `VITE_${v}`);
const craVars = envVars.map(v => `REACT_APP_${v}`);

const output = `
// Auto-generated - do not edit
declare namespace NodeJS {
  interface ProcessEnv {
${[...envVars, ...viteVars, ...craVars].map(v => `    ${v}?: string;`).join('\n')}
  }
}

// interface Window {
//   __TRACKKIT_ENV__?: {
//     PROVIDER?: string;
//     SITE_ID?: string;
//     HOST?: string;
//     QUEUE_SIZE?: string;
//     DEBUG?: string;
//   };
// }
// `.trim();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(
  path.join(__dirname, '../packages/trackkit/src/env.d.ts'),
  output
);