#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const SUMMARY_FILE = path.resolve('coverage', 'coverage-summary.json');

const GLOBAL_MIN = {
  statements: Number(process.env.COV_MIN_STATEMENTS ?? 90),
  lines:      Number(process.env.COV_MIN_LINES ?? 90),
  functions:  Number(process.env.COV_MIN_FUNCTIONS ?? 90),
  branches:   Number(process.env.COV_MIN_BRANCHES ?? 80),
};

const PER_FILE_MIN = {
  statements: Number(process.env.COV_FILE_MIN_STATEMENTS ?? 60),
  lines:      Number(process.env.COV_FILE_MIN_LINES ?? 60),
  functions:  Number(process.env.COV_FILE_MIN_FUNCTIONS ?? 60),
  branches:   Number(process.env.COV_FILE_MIN_BRANCHES ?? 30),  // handful of small files have low branch cov
};

// Files to ignore from per-file checks (already excluded glob-wise for global;
// this is an extra guard for odd edge-cases).
const PER_FILE_IGNORE = [
  /\/dist\//,
  /\.d\.ts$/,
  /\/index\.ts$/,
  /\/types\.ts$/,
  /\/__mocks__\//,
  /\/__fixtures__\//,
];

function pct(v) { return typeof v === 'number' ? v : 0; }

function readSummary(file) {
  if (!fs.existsSync(file)) {
    console.error(`coverage summary not found at ${file}. Did you run tests with --coverage?`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fail(msg) {
  console.error(`\n❌ Coverage check failed:\n${msg}\n`);
  process.exit(1);
}

const summary = readSummary(SUMMARY_FILE);

// 1) Global thresholds (Vitest already enforces these; this is a second, explicit guard)
const total = summary.total || {};
const globalFailures = [];
for (const k of ['statements', 'lines', 'functions', 'branches']) {
  const actual = pct(total[k]?.pct);
  const min = GLOBAL_MIN[k];
  if (actual < min) globalFailures.push(`  - ${k}: ${actual}% < ${min}%`);
}
if (globalFailures.length) {
  fail(`Global coverage below threshold:\n${globalFailures.join('\n')}`);
}

// 2) Per-file thresholds
const fileFailures = [];
for (const [file, data] of Object.entries(summary)) {
  if (file === 'total') continue;

  // ignore patterns
  if (PER_FILE_IGNORE.some((re) => re.test(file))) continue;

  for (const k of ['statements', 'lines', 'functions', 'branches']) {
    const actual = pct(data[k]?.pct);
    const min = PER_FILE_MIN[k];
    if (actual < min) {
      fileFailures.push(`  - ${file}: ${k} ${actual}% < ${min}%`);
    }
  }
}

if (fileFailures.length) {
  fail(`Per-file coverage below threshold:\n${fileFailures.join('\n')}`);
}

console.log('Coverage thresholds satisfied (global + per-file).');
