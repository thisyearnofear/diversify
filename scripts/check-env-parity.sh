#!/usr/bin/env bash
# =============================================================================
# Env parity check — NAMES ONLY. Never prints, logs, or writes a value.
#
# Compares three sources of truth:
#   1. scripts/required-env.json        — what the runtime NEEDS
#   2. the Hetzner server's .env        — what the runtime HAS (names via
#      grep -oE '^[A-Z0-9_]+=' — values never leave the server)
#   3. Vercel production env names      — `vercel env ls production` for the
#      `diversify` project, linked into a throwaway temp dir
#
# Output sections:
#   ✗ required-but-missing-on-server     → exit 1 (deploy-blocking)
#   ⚠ on-Vercel-but-not-on-server        → warning, only for vars actually
#      referenced via process.env.X in server code (apps/web/pages/api,
#      apps/web/lib, packages/shared/src); NEXT_PUBLIC_* ignored
#   ⚠ on-server-but-not-on-Vercel        → informational
#   ⚠ recommended missing somewhere      → warning
#
# Usage: scripts/check-env-parity.sh
# Wired into deploy-to-hetzner.sh before rsync.
# =============================================================================
set -uo pipefail

REMOTE="${DEPLOY_SSH_ALIAS:-snel-bot}"
RUNTIME_DIR="${DEPLOY_RUNTIME_DIR:-/home/deploy/diversifi-api-runtime}"
VERCEL_PROJECT="${VERCEL_PROJECT:-diversify}"
CONFIG_FILE="$(dirname "$0")/required-env.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}ℹ${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; }

command -v jq >/dev/null 2>&1 || { warn "jq missing — parity check skipped"; exit 0; }
[ -f "$CONFIG_FILE" ] || { warn "required-env.json missing — parity check skipped"; exit 0; }

TMP_LISTS=$(mktemp -d)
trap 'rm -rf "$TMP_LISTS"' EXIT
touch "$TMP_LISTS/vercel.txt" # comm needs the file even when Vercel is unreachable

# ── 1. Server env names (keys only — grep emits just the NAME= match) ────────
info "Reading env NAMES on $REMOTE:$RUNTIME_DIR/.env (values never transferred)..."
if ! ssh -o ConnectTimeout=8 -o BatchMode=yes "$REMOTE" \
    "grep -oE '^[A-Z0-9_]+=' '$RUNTIME_DIR/.env' | tr -d '=' | sort -u" \
    > "$TMP_LISTS/server.txt" 2>/dev/null; then
    warn "cannot read server env names over SSH — parity check skipped"
    exit 0
fi

# ── 2. Required names missing on the server (deploy-blocking) ───────────────
missing_required=0
while IFS= read -r key; do
    [ -z "$key" ] && continue
    if ! grep -qx "$key" "$TMP_LISTS/server.txt"; then
        err "required env var missing on server: $key"
        missing_required=$((missing_required + 1))
    fi
done < <(jq -r '.required[]' "$CONFIG_FILE")

# oneOf groups: at least one group fully present on the server
oneof_count=$(jq '.oneOf | length' "$CONFIG_FILE" 2>/dev/null || echo 0)
if [ "$oneof_count" -gt 0 ]; then
    group_satisfied=false
    for g in $(seq 0 $((oneof_count - 1))); do
        group_ok=true
        while IFS= read -r key; do
            if ! grep -qx "$key" "$TMP_LISTS/server.txt"; then
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
        err "no oneOf group is fully present on the server: $(jq -c '.oneOf' "$CONFIG_FILE")"
        missing_required=$((missing_required + 1))
    fi
fi

# expectedValues keys are presence-checked only as a warning — their values
# are enforced by check-env-drift.sh locally and required-env.js at boot, and
# a key like NODE_ENV may legitimately come from PM2 rather than the .env file.
while IFS= read -r key; do
    [ -z "$key" ] && continue
    if ! grep -qx "$key" "$TMP_LISTS/server.txt"; then
        warn "expectedValues key not in server .env (may be set by PM2/start script): $key"
    fi
done < <(jq -r '.expectedValues | keys[]' "$CONFIG_FILE" 2>/dev/null)

# ── 3. Vercel production env names ───────────────────────────────────────────
# `vercel env ls` needs a linked project dir; link into a throwaway temp dir
# so we never touch the repo's .vercel. Names only: column 1 of the table.
VERCEL_OK=false
VERCEL_DIR=$(mktemp -d)
if command -v vercel >/dev/null 2>&1; then
    (
        cd "$VERCEL_DIR"
        vercel link --yes --project "$VERCEL_PROJECT" >/dev/null 2>&1 \
            && vercel env ls production 2>/dev/null \
            | awk 'NR>2 && $1 ~ /^[A-Z0-9_]+$/ {print $1}' | sort -u \
            > "$TMP_LISTS/vercel.txt"
    )
    if [ -s "$TMP_LISTS/vercel.txt" ]; then
        VERCEL_OK=true
    else
        warn "vercel env ls unavailable (not linked/authed?) — skipping Vercel comparison"
    fi
else
    warn "vercel CLI not installed — skipping Vercel comparison"
fi
rm -rf "$VERCEL_DIR"

# ── 4. Server-used env names (referenced via process.env.X) ─────────────────
grep -rhoE 'process\.env\.[A-Z0-9_]+' \
    apps/web/pages/api apps/web/lib packages/shared/src \
    2>/dev/null \
    | sed 's/^process\.env\.//' | sort -u > "$TMP_LISTS/used.txt"

# ── 5. Report the deltas ─────────────────────────────────────────────────────
if [ "$VERCEL_OK" = "true" ]; then
    # On Vercel but not on the server — only warn for vars server code uses
    # and that aren't build-time NEXT_PUBLIC_* (those belong to Vercel only).
    comm -12 "$TMP_LISTS/vercel.txt" "$TMP_LISTS/used.txt" \
        | grep -vE '^NEXT_PUBLIC_' \
        | grep -vxF -f "$TMP_LISTS/server.txt" \
        > "$TMP_LISTS/vercel_missing_server.txt" || true
    if [ -s "$TMP_LISTS/vercel_missing_server.txt" ]; then
        warn "on Vercel + used by server code, but missing on the server:"
        sed 's/^/    /' "$TMP_LISTS/vercel_missing_server.txt"
    else
        ok "no server-used Vercel vars missing on the server"
    fi

    comm -13 "$TMP_LISTS/vercel.txt" "$TMP_LISTS/server.txt" \
        > "$TMP_LISTS/server_not_vercel.txt" || true
    if [ -s "$TMP_LISTS/server_not_vercel.txt" ]; then
        info "on server but not on Vercel (informational — may be runtime-only):"
        sed 's/^/    /' "$TMP_LISTS/server_not_vercel.txt"
    fi
fi

# Recommended tier — warn either direction, never fatal
while IFS= read -r key; do
    [ -z "$key" ] && continue
    grep -qx "$key" "$TMP_LISTS/server.txt" || warn "recommended var not on server: $key"
    if [ "$VERCEL_OK" = "true" ]; then
        grep -qx "$key" "$TMP_LISTS/vercel.txt" || warn "recommended var not on Vercel: $key"
    fi
done < <(jq -r '.recommended[]?' "$CONFIG_FILE" 2>/dev/null)

if [ "$missing_required" -gt 0 ]; then
    err "env parity failed: $missing_required required key(s) missing on server"
    exit 1
fi
ok "env parity check complete (server has all required names)"
