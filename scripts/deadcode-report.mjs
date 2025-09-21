import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;

function extractJsonBlock(txt) {
  // Find the first '{' and the last '}' and try to parse that slice
  const start = txt.indexOf("{");
  const end = txt.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = txt.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function runKnipJSON(cwd) {
  // Quiet pnpm and Knip; pass your shared TS config
  const cmd =
    "pnpm --silent knip --reporter json --no-progress --no-summary --tsConfig tsconfig.base.json";
  try {
    const out = execSync(cmd, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" } // many CLIs suppress spinners in CI
    }).toString();
    const parsed = extractJsonBlock(out);
    if (parsed) return parsed;
  } catch (e) {
    const mixed =
      (e?.stdout?.toString?.() ?? "") + (e?.stderr?.toString?.() ?? "");
    const parsed = extractJsonBlock(mixed);
    if (parsed) return parsed;

    throw new Error(
      "Knip did not produce parseable JSON. Try running manually:\n\n" +
        "  pnpm --silent knip --reporter json --no-progress --no-summary --tsConfig tsconfig.base.json\n"
    );
  }
}

function collectUnused(knipJson) {
  const buckets = [];

  // 1) Some knip versions may still emit a top-level "unused"
  if (knipJson?.unused) buckets.push(knipJson.unused);

  // 2) Most monorepo results live under workspaces[<path>].unused
  if (knipJson?.workspaces && typeof knipJson.workspaces === "object") {
    for (const ws of Object.values(knipJson.workspaces)) {
      if (ws?.unused) buckets.push(ws.unused);
    }
  }

  // 3) Merge
  const files = new Set();
  const exports = [];
  const types = []; // optional: unused exported types, if present

  for (const b of buckets) {
    (b.files || []).forEach(f => files.add(f));
    (b.exports || []).forEach(e => exports.push(e));
    (b.types || []).forEach(t => types.push(t)); // some schemas use "types"
  }

  return { files: [...files], exports, types };
}

const knipJson = runKnipJSON(repoRoot);

// 1) Run knip with JSON reporter
// let knipJson;
// try {
//   const cmd = "pnpm knip --reporter json --tsConfig tsconfig.base.json";
//   const out = execSync(cmd, {
//     cwd: repoRoot,
//     stdio: ["ignore", "pipe", "pipe"]
//   }).toString();
//   knipJson = JSON.parse(out);
// } catch (e) {
//   console.error("Failed to run knip --reporter json:", e?.message || e);
//   process.exit(1);
// }

// 2) Load V8/istanbul coverage (Vitest wrote coverage-final.json)
const coverageFile = path.join(
  repoRoot,
  "packages",
  "trackkit",
  "coverage",
  "coverage-final.json"
);
let coverage = {};
if (fs.existsSync(coverageFile)) {
  coverage = JSON.parse(fs.readFileSync(coverageFile, "utf-8"));
}

// 3) Compute zero-hit files from coverage
const zeroHitFiles = new Set();
for (const [file, data] of Object.entries(coverage)) {
  const s = data.s || {};
  const hits = Object.values(s).reduce((a, b) => a + (b || 0), 0);
  if (hits === 0) zeroHitFiles.add(path.relative(repoRoot, file));
}

// 4) Extract knip candidates
const { files: unusedFilesArr, exports: unusedExportsArr, types: unusedTypesArr } =
  collectUnused(knipJson);

const unusedFiles = new Set(unusedFilesArr);
const unusedExports = unusedExportsArr;
// const unusedFiles = new Set(knipJson?.unused?.files || []);
// const unusedExports = (knipJson?.unused?.exports || []).map(e => ({
//   file: e.file,
//   name: e.name
// }));

// 5) Merge and print markdown report
const title = "# Dead Code Report (Knip + Coverage)";
const unusedFilesList = [...unusedFiles].sort();
const zeroHitList = [...zeroHitFiles].sort();

let md = `${title}

## A) Unused files (Knip)
${unusedFilesList.length ? unusedFilesList.map(f => `- \`${f}\``).join("\n") : "_None found_"}

## B) Files with 0 runtime/test hits (coverage)
${zeroHitList.length ? zeroHitList.map(f => `- \`${f}\``).join("\n") : "_None found_"}

## C) Unused exports (Knip)
${
  unusedExports.length
    ? unusedExports
        .sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))
        .map(e => `- \`${e.file}\` ⟶ \`${e.name}\``)
        .join("\n")
    : "_None found_"
}

## D) Unused exported types (Knip)
${
  unusedTypesArr?.length
    ? unusedTypesArr
        .sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))
        .map(t => `- \`${t.file}\` ⟶ \`${t.name}\``)
        .join("\n")
    : "_None found_"
}

> Tip: Prefer deleting items that appear in **both A and B**; for items only in C, consider removing/privatizing the export rather than the whole file.
`;

console.log(md);
