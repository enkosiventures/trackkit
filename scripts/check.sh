#!/usr/bin/env bash

set -euo pipefail

# ---------- options ----------
QUICK=0
NO_INSTALL=0
WITH_DOCS=0
FILTER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick) QUICK=1; shift ;;
    --no-install) NO_INSTALL=1; shift ;;
    --docs) WITH_DOCS=1; shift ;;
    --filter) FILTER="${2:-}"; shift 2 ;;
    --help|-h)
      cat <<'USAGE'
Usage: scripts/check.sh [--quick] [--no-install] [--docs] [--filter <selector>]
USAGE
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

say()  { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()   { printf "\033[0;32m✓ %s\033[0m\n" "$*\n"; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 127; }; }

need pnpm

# Helper: Run via root script (defaults) OR raw filter if override provided
run_task() {
  local TASK="$1"
  if [[ -n "$FILTER" ]]; then
    # If explicit filter provided, run directly against those packages
    pnpm --filter "$FILTER" run "$TASK"
  else
    # Otherwise, rely on root package.json definition (which excludes examples)
    pnpm run "$TASK"
  fi
}

if [[ ${NO_INSTALL} -eq 0 && ${QUICK} -eq 0 ]]; then
  say "Install dependencies"
  pnpm install --frozen-lockfile
  ok "Install done"
fi

say "Build (all${FILTER:+, filter=$FILTER})"
run_task build
ok "Build ok"

say "Type check (all${FILTER:+, filter=$FILTER})"
run_task typecheck
ok "Typecheck ok"

say "Lint (all${FILTER:+, filter=$FILTER})"
pnpm run lint
ok "Lint ok"

say "Test (all${FILTER:+, filter=$FILTER})"
CI=1 run_task test:coverage
ok "Tests ok, coverage emitted"

# Checks Trackkit core package only.
if [[ ${QUICK} -eq 0 ]]; then
  
  # These commands are specific to the 'trackkit' package logic
  # We can run them via root scripts or explicit filter.
  # Root 'defaults:inject' is recursive, but we only really care about trackkit here.
  
  say "Inject @default into .d.ts"
  pnpm --filter trackkit run defaults:inject
  ok "Defaults injected"

  say "Assert '.d.ts' reflect real runtime values"
  pnpm --filter trackkit run defaults:assert
  ok "Defaults assertion ok"

  say "Test coverage check"
  pnpm --filter trackkit run coverage:check
  ok "Coverage ok"

  say "Dead code gate (coverage + Knip)"
  pnpm --filter trackkit run deadcode:gate
  ok "Dead code gate ok"

  say "Check bundle size"
  run_task size
  ok "Bundle size ok"

  if [[ ${WITH_DOCS} -eq 1 ]]; then
    say "Build docs"
    pnpm run docs:build
    ok "Docs built"
  fi
fi

say "All checks passed"