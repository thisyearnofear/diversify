#!/usr/bin/env bash
# =============================================================================
# Pre-deploy environment drift detector.
#
# Compares .env.local against the required list in scripts/required-env.json
# (same source of truth used by scripts/required-env.js at boot).
#
# Exits 0 if .env.local has all required vars + satisfies at least one
# "oneOf" group + matches all "expectedValues" constraints.
#
# Exits 1 with a clear, actionable error list otherwise.
#
# Usage:
#   scripts/check-env-drift.sh
#   scripts/check-env-drift.sh path/to/.env.local
#
# Wired into scripts/deploy-to-hetzner.sh to fail the deploy BEFORE any rsync
# happens. That way a forgotten env var never makes it to production.
# =============================================================================
set -euo pipefail

ENV_FILE="${1:-.env.local}"
CONFIG_FILE="$(dirname "$0")/required-env.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

err()   { echo -e "${RED}✗${NC} $*" >&2; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }

[ -f "$CONFIG_FILE" ] || { err "config not found: $CONFIG_FILE"; exit 1; }
[ -f "$ENV_FILE" ]    || { err ".env file not found: $ENV_FILE"; exit 1; }

command -v jq >/dev/null 2>&1 || { err "jq is required for this script"; exit 1; }

# Read a value from the env file. KEY=VALUE or KEY="VALUE" or KEY='VALUE'.
read_env_value() {
  local key="$1"
  local env_file="$2"
  # shellcheck disable=SC2002
  cat "$env_file" | sed -n "s/^${key}=\(.*\)$/\1/p" | head -1 | sed -e "s/^['\"]//" -e "s/['\"]$//"
}

is_empty() {
  local v="$1"
  [ -z "$v" ] || [ "$v" = '""' ] || [ "$v" = "''" ]
}

errors=0

# 1. Check required vars
while IFS= read -r key; do
  value="$(read_env_value "$key" "$ENV_FILE")"
  if is_empty "$value"; then
    err "missing or empty: $key"
    errors=$((errors + 1))
  fi
done < <(jq -r '.required[]' "$CONFIG_FILE")

# 2. Check oneOf groups — at least one group must be fully present
oneof_count=$(jq '.oneOf | length' "$CONFIG_FILE")
if [ "$oneof_count" -gt 0 ]; then
  group_satisfied=false
  for g in $(seq 0 $((oneof_count - 1))); do
    group_ok=true
    while IFS= read -r key; do
      value="$(read_env_value "$key" "$ENV_FILE")"
      if is_empty "$value"; then
        group_ok=false
        break
      fi
    done < <(jq -r ".oneOf[$g][]" "$CONFIG_FILE")
    if [ "$group_ok" = "true" ]; then
      group_satisfied=true
      break
    fi
  done
  if [ "$group_satisfied" = "false" ]; then
    err "no oneOf group is fully satisfied. Need ALL of: $(jq -c '.oneOf' "$CONFIG_FILE")"
    errors=$((errors + 1))
  fi
fi

# 3. Check expectedValues
while IFS=$'\t' read -r key allowed_csv; do
  value="$(read_env_value "$key" "$ENV_FILE")"
  if is_empty "$value"; then
    continue # already counted as missing
  fi
  # Split allowed_csv on comma and check membership
  match=false
  IFS=',' read -ra allowed_arr <<< "$allowed_csv"
  for a in "${allowed_arr[@]}"; do
    if [ "$value" = "$a" ]; then
      match=true
      break
    fi
  done
  if [ "$match" = "false" ]; then
    err "$key=$value but must be one of: $allowed_csv"
    errors=$((errors + 1))
  fi
done < <(jq -r '.expectedValues | to_entries[] | "\(.key)\t\(.value | join(","))"' "$CONFIG_FILE")

if [ "$errors" -gt 0 ]; then
  err "drift check failed with $errors error(s)"
  err "fix $ENV_FILE and re-run"
  exit 1
fi

ok "drift check passed ($ENV_FILE matches $CONFIG_FILE)"
