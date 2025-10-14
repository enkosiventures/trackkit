import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const pkgDir = path.join(repoRoot, 'packages', 'trackkit');

// ---------- Config knobs ----------
/**
 * We’ll try these arg sets in order until one produces valid JSON.
 * This handles Knip versions that don’t support --no-summary / --no-progress.
 */
const KNIP_ARGSETS = [
  ['--reporter', 'json', '--no-progress', '--no-summary', '--tsConfig', 'tsconfig.base.json'],
  ['--reporter', 'json', '--no-progress', '--tsConfig', 'tsconfig.base.json'],
  ['--reporter', 'json', '--tsConfig', 'tsconfig.base.json'],
  ['--reporter', 'json'],
];

// Files to ignore in zero-coverage section (pure type files are common noise)
const ZERO_COVERAGE_IGNORE = [
  /\/src\/.*\/types\.ts$/,
  /\/src\/queues\/types\.ts$/,
];
// ----------------------------------

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1' },
  });
}

// Robust JSON extractor in case CLI prefixes/suffixes
function extractJsonBlock(txt) {
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(txt.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const out = {
    out: path.join(pkgDir, 'deadcode-report.md'),
    failOnUnused: false,
    maxUnusedFiles: 0,
    maxUnusedExports: 0,
    maxUncoveredFiles: 0,
    ensureCoverage: false,        // fail if coverage file is missing
    includeStatementless: false,  // include .ts “types-only” files in zero-hit
    workspace: false,             // accepted but no-op (compat)
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') out.out = path.resolve(repoRoot, argv[++i]);
    else if (a === '--fail-on-unused') out.failOnUnused = true;
    else if (a === '--max-unused-files') out.maxUnusedFiles = Number(argv[++i] ?? 0);
    else if (a === '--max-unused-exports') out.maxUnusedExports = Number(argv[++i] ?? 0);
    else if (a === '--max-uncovered-files') out.maxUncoveredFiles = Number(argv[++i] ?? 0);
    else if (a === '--ensure-coverage') out.ensureCoverage = true;
    else if (a === '--include-statementless') out.includeStatementless = true;
    else if (a === '--workspace') out.workspace = true; // no-op, we already aggregate workspaces
  }
  return out;
}

function tryRunKnip(args) {
  try {
    const out = run('pnpm', ['--silent', 'knip', ...args], repoRoot);
    return extractJsonBlock(out) ?? null;
  } catch (e) {
    const mixed = String((e?.stdout ?? '') + (e?.stderr ?? ''));
    return extractJsonBlock(mixed) ?? null;
  }
}

function runKnipJSON() {
  for (const args of KNIP_ARGSETS) {
    const json = tryRunKnip(args);
    if (json) return json;
  }
  throw new Error(
    `Knip did not produce parseable JSON with any arg set.
Tried:
${KNIP_ARGSETS.map(a => '  knip ' + a.join(' ')).join('\n')}
Tip: check "pnpm knip --reporter json --help" and/or pin Knip to a consistent version.`
  );
}

function loadCoverageJSON() {
  const covPath = path.join(pkgDir, 'coverage', 'coverage-final.json');
  if (!fs.existsSync(covPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(covPath, 'utf8'));
  } catch {
    return null;
  }
}

function summarizeCoverage(cov, ignorePatterns) {
  if (!cov) return { zeroFiles: [], totalFiles: 0 };
  const zeroFiles = [];
  for (const [absFile, m] of Object.entries(cov)) {
    const s = m?.s || {};
    const total = Object.keys(s).length || 0;
    const covered = Object.values(s).filter((v) => v > 0).length;
    if (total > 0 && covered === 0) {
      zeroFiles.push(path.relative(repoRoot, absFile));
    }
  }
  const filtered = zeroFiles.filter((rel) => !ignorePatterns.some((re) => re.test(rel)));
  return { zeroFiles: filtered, totalFiles: Object.keys(cov).length };
}

function toList(xs) {
  return xs.length ? xs.map((x) => `- \`${x}\``).join('\n') : '_None found_';
}
function toPairList(xs) {
  return xs.length ? xs.map(({ file, name }) => `- \`${file}\` ⟶ \`${name}\``).join('\n') : '_None found_';
}

function renderMarkdown(sections) {
  const {
    unusedFiles, unusedExports, unusedTypes, unlisted, unresolved, zeroCoverageFiles, overlaps,
  } = sections;

  const title = '# Dead Code Report (Knip + Coverage)';
  const summary = [
    `**Unused files**: ${unusedFiles.length}`,
    `**Zero-hit files**: ${zeroCoverageFiles.length}`,
    `**Unused exports**: ${unusedExports.length}`,
    `**Unused exported types**: ${unusedTypes.length}`,
    `**Unlisted deps**: ${unlisted.length}`,
    `**Unresolved imports**: ${unresolved.length}`,
    `**Overlaps (unused + zero-hit)**: ${overlaps.length}`,
  ].join(' · ');

  return [
    title,
    '',
    summary,
    '',
    `## A) Unused files (Knip) — ${unusedFiles.length}`,
    toList(unusedFiles),
    '',
    `## B) Files with 0 hits (coverage) — ${zeroCoverageFiles.length}`,
    toList(zeroCoverageFiles),
    '',
    `## C) Unused exports (Knip) — ${unusedExports.length}`,
    toPairList(unusedExports),
    '',
    `## D) Unused exported types (Knip) — ${unusedTypes.length}`,
    toPairList(unusedTypes),
    '',
    `## E) Unlisted dependencies (Knip) — ${unlisted.length}`,
    toPairList(unlisted),
    '',
    `## F) Unresolved imports (Knip) — ${unresolved.length}`,
    toPairList(unresolved),
    '',
    overlaps.length
      ? `## G) High-confidence removals (A ∩ B) — ${overlaps.length}\n${toList(overlaps)}\n`
      : '',
    '> Tip: Prefer deleting items that appear in **both A and B**. For items only in C/D, consider removing or privatizing the export.',
  ].join('\n');
}

// -------- Enhanced Knip result normalization --------

// Helper: add an item to a Set safely.
function addToSet(set, v) {
  if (v) set.add(v);
}

// Accepts a Knip "{ issues: {...} }" object OR a legacy "{ unused: {...} }" object OR the inner {...} itself.
// Merges findings into the accumulator Sets/arrays.
function collectFromIssuesObject(maybeIssues, acc) {
  if (!maybeIssues || typeof maybeIssues !== 'object') return;

  // If we were given the modern wrapper { issues: {...} }, unwrap:
  const issues = (maybeIssues.issues && typeof maybeIssues.issues === 'object')
    ? maybeIssues.issues
    : (maybeIssues.unused && typeof maybeIssues.unused === 'object')
      ? maybeIssues.unused
      : maybeIssues;

  // files: string[] | { file: string }[]
  const files = Array.isArray(issues.files) ? issues.files : [];
  for (const f of files) addToSet(acc.unusedFiles, typeof f === 'string' ? f : f?.file);

  // exports/types/unlisted/unresolved: arrays of { file, name } | sometimes strings
  const pushPairs = (arr, out) => {
    if (!Array.isArray(arr)) return;
    for (const it of arr) {
      if (!it) continue;
      if (typeof it === 'string') {
        // Some shapes emit raw strings; map to { file: ?, name: string } when we can't split.
        out.push({ file: '(unknown)', name: it });
      } else if (it.file && it.name) {
        out.push({ file: it.file, name: it.name });
      } else if (it.file && it.symbol) {
        out.push({ file: it.file, name: it.symbol });
      } else if (it.file) {
        out.push({ file: it.file, name: '(unknown)' });
      }
    }
  };

  pushPairs(issues.exports, acc.unusedExports);
  pushPairs(issues.types, acc.unusedTypes);
  pushPairs(issues.unlisted, acc.unlisted);
  pushPairs(issues.unresolved, acc.unresolved);

  // Some Knip versions also expose a flat array at "issues" (array). Support that too.
  if (Array.isArray(maybeIssues.issues)) {
    for (const perFile of maybeIssues.issues) {
      const file = perFile?.file;
      if (!file || typeof perFile !== 'object') continue;

      (perFile.exports || []).forEach((e) => acc.unusedExports.push({ file, name: e.name }));
      (perFile.types || []).forEach((t) => acc.unusedTypes.push({ file, name: t.name }));
      (perFile.unlisted || []).forEach((u) => acc.unlisted.push({ file, name: u.name || u }));
      (perFile.unresolved || []).forEach((u) => acc.unresolved.push({ file, name: u.name || u }));
    }
  }
}

function normalizeKnip(knipJson) {
  const acc = {
    unusedFiles: new Set(),     // Set<string>
    unusedExports: [],          // Array<{file, name}>
    unusedTypes: [],            // Array<{file, name}>
    unlisted: [],               // Array<{file, name}>
    unresolved: [],             // Array<{file, name}>
  };

  // 1) Single-package, modern
  if (knipJson?.issues) {
    collectFromIssuesObject(knipJson, acc);
  }

  // 2) Monorepo workspaces
  if (knipJson?.workspaces && typeof knipJson.workspaces === 'object') {
    for (const ws of Object.values(knipJson.workspaces)) {
      if (!ws) continue;
      // Some shapes: { workspaces: { wsPath: { issues: {...} } } }
      if (ws.issues || ws.unused) collectFromIssuesObject(ws, acc);
      // Some shapes: { workspaces: { wsPath: { files: [...] } } }
      if (Array.isArray(ws.files)) {
        for (const f of ws.files) addToSet(acc.unusedFiles, typeof f === 'string' ? f : f?.file);
      }
    }
  }

  // 3) Legacy single-package: { unused: {...} }
  if (knipJson?.unused) {
    collectFromIssuesObject(knipJson.unused, acc);
  }

  return {
    unusedFiles: Array.from(acc.unusedFiles),
    unusedExports: acc.unusedExports,
    unusedTypes: acc.unusedTypes,
    unlisted: acc.unlisted,
    unresolved: acc.unresolved,
  };
}

// ------------------- Main -------------------

function main() {
  const args = parseArgs(process.argv);

  const knip = runKnipJSON();
  const {
    unusedFiles,
    unusedExports,
    unusedTypes,
    unlisted,
    unresolved,
  } = normalizeKnip(knip);

  const coverage = loadCoverageJSON();

  // Enforce coverage presence if requested
  if (args.ensureCoverage && !coverage) {
    console.error('Dead-code gate failed: coverage-missing.');
    process.exit(1);
  }

  // Toggle whether we ignore “types-only” files
  const ignorePatterns = args.includeStatementless ? [] : ZERO_COVERAGE_IGNORE;
  const { zeroFiles: zeroCoverageFiles } = summarizeCoverage(coverage, ignorePatterns);

  const overlaps = unusedFiles.filter((f) => zeroCoverageFiles.includes(f));

  const md = renderMarkdown({
    unusedFiles,
    unusedExports,
    unusedTypes,
    unlisted,
    unresolved,
    zeroCoverageFiles,
    overlaps,
  });

  console.log(md);
  try { fs.writeFileSync(args.out, md); } catch {}

  const failBecauseFailOnUnused = args.failOnUnused && (unusedFiles.length > 0 || unusedExports.length > 0);
  const failByThresholds =
    unusedFiles.length > args.maxUnusedFiles ||
    unusedExports.length > args.maxUnusedExports ||
    zeroCoverageFiles.length > args.maxUncoveredFiles;

  if (failBecauseFailOnUnused || failByThresholds) {
    const reasons = [];
    if (failBecauseFailOnUnused) reasons.push('fail-on-unused');
    if (unusedFiles.length > args.maxUnusedFiles) reasons.push(`unused-files>${args.maxUnusedFiles}`);
    if (unusedExports.length > args.maxUnusedExports) reasons.push(`unused-exports>${args.maxUnusedExports}`);
    if (zeroCoverageFiles.length > args.maxUncoveredFiles) reasons.push(`zero-coverage>${args.maxUncoveredFiles}`);
    console.error(`Dead-code gate failed: ${reasons.join(', ')}.`);
    process.exit(1);
  }
  console.log('Dead-code gate passed.');
}


main();
