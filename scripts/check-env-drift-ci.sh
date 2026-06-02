#!/usr/bin/env bash
# ============================================================================
# CI Env Drift Detector
#
# Scans the PR diff for new process.env.XXX usages and verifies each one
# has a corresponding entry in .env.example. This prevents silent drift
# where code depends on an env var that's undocumented.
#
# Usage:
#   scripts/check-env-drift-ci.sh
#   scripts/check-env-drift-ci.sh --base-branch origin/main
#   scripts/check-env-drift-ci.sh --env-file .env.example
#
# Exit codes:
#   0 - all clear
#   1 - drift detected (new process.env usage missing from .env.example)
# ============================================================================
set -euo pipefail

# --- Config ----------------------------------------------------------------
BASE_BRANCH="origin/main"
ENV_FILE=".env.example"

# Known env vars used in code that don't need a .env.example entry.
# Add ONLY after verifying the var is:
#   - A runtime-derived value (e.g. NODE_ENV is set by the runtime)
#   - A legacy var that will be removed soon
#   - A test-only or CI-only var
KNOWN_UNDOCUMENTED=(
  "NODE_ENV"
  "NEXT_PUBLIC_ENV"
  "ANALYZE"
  "NETWORK"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}i${NC} $1"; }
ok()    { echo -e "${GREEN}v${NC} $1"; }
warn()  { echo -e "${YELLOW}w${NC} $1"; }
err()   { echo -e "${RED}x${NC} $1" >&2; }

# --- Parse args ------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-branch) BASE_BRANCH="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --help|-h) echo "Usage: $0 [--base-branch <branch>] [--env-file <path>]"; exit 0 ;;
    *) err "Unknown argument: $1"; exit 1 ;;
  esac
done

# --- Prerequisites ---------------------------------------------------------
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  err "Not inside a git repository."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  err ".env.example not found at $ENV_FILE"
  exit 1
fi

echo ""
echo "=== CI Env Drift Detector ==="
echo ""
info "Base branch: $BASE_BRANCH"
info "Env file:    $ENV_FILE"
echo ""

# --- Step 1: Parse .env.example into a lookup file -------------------------
DOC_KEYS_FILE=$(mktemp /tmp/env-doc-keys.XXXXXX)
trap 'rm -f "$DOC_KEYS_FILE"' EXIT

while IFS='=' read -r key rest; do
  # Trim whitespace
  key="${key#"${key%%[![:space:]]*}"}"
  key="${key%"${key##*[![:space:]]}"}"
  # Skip blanks, comments, non-variable lines
  if [[ -z "$key" || "$key" =~ ^# || ! "$key" =~ ^[A-Z_][A-Z_0-9]*$ ]]; then
    continue
  fi
  echo "$key" >> "$DOC_KEYS_FILE"
done < "$ENV_FILE"

DOC_KEY_COUNT=$(sort -u "$DOC_KEYS_FILE" | wc -l | tr -d ' ')
info "Found $DOC_KEY_COUNT documented env vars in $ENV_FILE"

# Build known-undocumented lookup file
KNOWN_FILE=$(mktemp /tmp/env-known.XXXXXX)
trap 'rm -f "$KNOWN_FILE" "$DOC_KEYS_FILE"' EXIT
for k in "${KNOWN_UNDOCUMENTED[@]}"; do
  echo "$k" >> "$KNOWN_FILE"
done

# Helper: check membership via grep -Fxq
in_file() { grep -Fxq "$1" "$2" 2>/dev/null; }

# --- Step 2: Get the diff ------------------------------------------------
if MERGE_BASE=$(git merge-base HEAD "$BASE_BRANCH" 2>/dev/null); then
  DIFF_RANGE="$MERGE_BASE..HEAD"
  info "Diff range: $MERGE_BASE..HEAD ($BASE_BRANCH merge-base)"
else
  DIFF_RANGE="$BASE_BRANCH...HEAD"
  info "Diff range: $BASE_BRANCH...HEAD"
fi

ADDED_LINES=$(git diff "$DIFF_RANGE" --diff-filter=ACMR -- \
  '*.ts' '*.tsx' '*.js' '*.mjs' '*.jsx' \
  -- . ':!node_modules' ':!.next' ':!lib' ':!__tests__' ':!*.test.*' ':!*.spec.*' \
  2>/dev/null | grep -E '^\+[^+]' || true)

if [[ -z "$ADDED_LINES" ]]; then
  info "No added lines in diff - nothing to check."
  ok "Env drift check passed"
  exit 0
fi

# --- Step 3: Extract process.env patterns from added lines -----------------
UNDOCUMENTED_VARS=()
FLAGGED_FILE=$(mktemp /tmp/env-flagged.XXXXXX)
trap 'rm -f "$FLAGGED_FILE" "$KNOWN_FILE" "$DOC_KEYS_FILE"' EXIT

flag_var() {
  local var="$1"
  [[ -z "$var" ]] && return
  in_file "$var" "$DOC_KEYS_FILE" && return
  in_file "$var" "$KNOWN_FILE" && return
  [[ "$var" == NEXT_PUBLIC_* ]] && return
  in_file "$var" "$FLAGGED_FILE" && return
  echo "$var" >> "$FLAGGED_FILE"
  UNDOCUMENTED_VARS+=("$var")
}

while IFS= read -r line; do
  # Skip comment-only lines and imports
  if echo "$line" | grep -qE '^\+[[:space:]]*(//|\*|import|///)'; then
    continue
  fi

  # Form 1: process.env.FOO (dot notation)
  while IFS= read -r var; do
    flag_var "$var"
  done < <(echo "$line" | grep -oE 'process\.env\.([A-Z_][A-Z_0-9]*)' | sed 's/process\.env\.//' || true)

  # Form 2: process.env['FOO'] (single-quote bracket)
  while IFS= read -r var; do
    flag_var "$var"
  done < <(echo "$line" | grep -oE "process\.env\['[A-Z_][A-Z_0-9]*'\]" | tr -d "'" | sed 's/process\.env\[//;s/\]//' || true)

  # Form 3: process.env["FOO"] (double-quote bracket)
  while IFS= read -r var; do
    flag_var "$var"
  done < <(echo "$line" | grep -oE 'process\.env\["[A-Z_][A-Z_0-9]*"\]' | tr -d '"' | sed 's/process\.env\[//;s/\]//' || true)

done <<< "$ADDED_LINES"

# --- Step 4: Report results -----------------------------------------------
if [[ ${#UNDOCUMENTED_VARS[@]} -eq 0 ]]; then
  echo ""
  ok "All process.env usages in this PR are documented in $ENV_FILE"
  exit 0
fi

echo ""
err "Drift detected! Found ${#UNDOCUMENTED_VARS[@]} undocumented env var(s):"
echo ""
for v in "${UNDOCUMENTED_VARS[@]}"; do
  err "  - $v"
done
echo ""
err "Each new process.env.XXX usage must have a corresponding entry in"
err "$ENV_FILE so the team knows it exists, what it does, and where"
err "to get its value."
echo ""
err "To fix: add the missing entries to $ENV_FILE in this PR."
echo ""
err "If the var is intentionally runtime-derived (e.g. NODE_ENV), add it"
err "to the KNOWN_UNDOCUMENTED array in scripts/check-env-drift-ci.sh"
err "with a brief comment explaining why."
echo ""
exit 1
