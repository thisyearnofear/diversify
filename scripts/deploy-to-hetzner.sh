#!/usr/bin/env bash
# =============================================================================
# DiversiFi — Local Build → Hetzner Deploy
#
# Builds the Next.js project LOCALLY (your Mac/CI), then rsyncs only the
# compiled .next/ output to the Hetzner runtime directory. This keeps the
# server lean — no git clone, no node_modules, no build tools needed.
#
# Usage:
#   chmod +x scripts/deploy-to-hetzner.sh
#   ./scripts/deploy-to-hetzner.sh
#
# Environment variables (optional overrides):
#   DEPLOY_SSH_ALIAS   SSH alias for Hetzner (default: snel-bot)
#   DEPLOY_RUNTIME_DIR Runtime path on server (default: /home/deploy/diversifi-api-runtime)
#   DEPLOY_APP_NAME    PM2 app name (default: diversifi-api)
#   DEPLOY_SKIP_BUILD  Set to "true" to skip the local build step
#   DEPLOY_SYNC_ENV    Set to "true" to also sync .env.local to the server
#
# Prerequisites:
#   - SSH alias configured in ~/.ssh/config
#   - pnpm installed locally
#   - Project dependencies installed (pnpm install)
# =============================================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
REMOTE="${DEPLOY_SSH_ALIAS:-snel-bot}"
RUNTIME_DIR="${DEPLOY_RUNTIME_DIR:-/home/deploy/diversifi-api-runtime}"
APP_NAME="${DEPLOY_APP_NAME:-diversifi-api}"
SKIP_BUILD="${DEPLOY_SKIP_BUILD:-false}"
SYNC_ENV="${DEPLOY_SYNC_ENV:-false}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}ℹ${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; exit 1; }

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DiversiFi — Local Build → Hetzner Deploy                     ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
info "Remote:        $REMOTE"
info "Runtime dir:   $RUNTIME_DIR"
info "PM2 app:       $APP_NAME"
info "Skip build:    $SKIP_BUILD"
echo ""

# ── 1. Verify SSH connection ────────────────────────────────────────────────
info "Checking SSH connection to $REMOTE..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$REMOTE" "echo connected" >/dev/null 2>&1; then
    fail "Cannot connect to $REMOTE via SSH. Check your config."
fi
ok "SSH connection established"

# ── 2. Build locally ─────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = "true" ]; then
    warn "Skipping build (DEPLOY_SKIP_BUILD=true)"
else
    # Ensure we're in the project root
    if [ ! -f "package.json" ]; then
        fail "Run this script from the project root (where package.json lives)"
    fi

    info "Building locally (pnpm build)..."
    if ! pnpm build; then
        fail "Local build failed. Fix errors and try again."
    fi
    ok "Local build complete"

    # Verify build artifacts exist
    if [ ! -f ".next/BUILD_ID" ]; then
        fail "Build artifacts not found at .next/BUILD_ID — build may have failed silently"
    fi
    ok "Build artifacts verified (.next/BUILD_ID present)"
fi

# ── 3. Rsync standalone build to Hetzner runtime dir ────────────────────────
if [ ! -f ".next/standalone/server.js" ]; then
    fail "Standalone output not found at .next/standalone/server.js — ensure next.config uses output: 'standalone'"
fi

info "Syncing standalone build to $REMOTE:$RUNTIME_DIR/ ..."

LOCAL_SIZE=$(du -sh .next/standalone 2>/dev/null | cut -f1)
info "Local standalone size: $LOCAL_SIZE"

# Sync the standalone server, excluding server-managed files that must not be
# overwritten (env vars, startup script). --delete removes stale build files.
rsync -az --delete --no-owner --no-group \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='start-runtime.sh' \
    --exclude='instrument.js' \
    .next/standalone/ \
    "$REMOTE:$RUNTIME_DIR/" 2>&1 | tail -5

# Static assets live inside .next/static/ which standalone doesn't include
info "Syncing static assets..."
rsync -az --delete --no-owner --no-group \
    .next/static/ \
    "$REMOTE:$RUNTIME_DIR/.next/static/" 2>&1 | tail -3

ok "Rsync complete"

# ── 4. Optionally sync .env.local ───────────────────────────────────────────
if [ "$SYNC_ENV" = "true" ]; then
    if [ -f ".env.local" ]; then
        info "Syncing .env.local → $RUNTIME_DIR/.env on server..."
        scp ".env.local" "$REMOTE:$RUNTIME_DIR/.env"
        ok "Environment synced"
    else
        warn ".env.local not found locally — skipping env sync"
    fi
fi

# ── 5. Sync start-runtime.sh + instrument.js (always, not just on first run) ──
# These are the runtime entry point and a pre-required module respectively.
# Both ship from the repo on every deploy so handler changes don't get stuck
# behind an `if [ -f ]` guard.
info "Syncing scripts/start-runtime.sh..."
scp "scripts/start-runtime.sh" "$REMOTE:$RUNTIME_DIR/start-runtime.sh"
ssh "$REMOTE" "chmod +x $RUNTIME_DIR/start-runtime.sh"
ok "start-runtime.sh synced"

info "Syncing scripts/instrument.js..."
scp "scripts/instrument.js" "$REMOTE:$RUNTIME_DIR/instrument.js"
ok "instrument.js synced"

# ── 6. Restart PM2 ──────────────────────────────────────────────────────────
info "Restarting PM2 ($APP_NAME)..."
ssh "$REMOTE" "pm2 restart $APP_NAME --update-env" || {
    warn "PM2 restart failed — trying to start fresh"
    ssh "$REMOTE" "pm2 start $RUNTIME_DIR/start-runtime.sh --name $APP_NAME --interpreter bash"
}

# Wait for the server to stabilize
# Poll PM2 status up to 30s (every 3s) instead of a fixed sleep
info "Waiting for server to stabilize (polling PM2 up to 30s)..."
PM2_ONLINE=false
for i in $(seq 1 10); do
    PM2_STATUS=$(ssh "$REMOTE" "pm2 status $APP_NAME 2>&1 | grep -E 'online|errored|stopped' | head -1")
    if echo "$PM2_STATUS" | grep -q "online"; then
        PM2_ONLINE=true
        break
    fi
    sleep 3
done

if [ "$PM2_ONLINE" = "true" ]; then
    ok "PM2 status: online"
    # Give the process a moment to bind the port after PM2 reports online
    sleep 2
else
    warn "PM2 status did not reach 'online' after 30s — checking logs..."
    ssh "$REMOTE" "pm2 logs $APP_NAME --lines 15 --nostream 2>&1 | tail -10"
fi

# ── 7. Verify endpoints ──────────────────────────────────────────────────────
info "Verifying local endpoint on server..."
HTTP_CODE=$(ssh "$REMOTE" "curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:6174/api/agent/status 2>&1" || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    ok "Local endpoint: HTTP $HTTP_CODE"
else
    warn "Local endpoint returned HTTP $HTTP_CODE"
fi

# Quick check that x402-metrics also responds
info "Verifying x402-metrics endpoint..."
X402_CODE=$(ssh "$REMOTE" "curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://127.0.0.1:6174/api/agent/x402-metrics 2>&1" || echo "000")
if [ "$X402_CODE" = "200" ]; then
    ok "x402-metrics: HTTP $X402_CODE"
else
    warn "x402-metrics returned HTTP $X402_CODE"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy complete!                                           ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
info "API:      https://api.diversifi.famile.xyz/api/agent/status"
info "Metrics:  https://api.diversifi.famile.xyz/api/agent/x402-metrics"
info "Ledger:   https://api.diversifi.famile.xyz/api/agent/zero-g-ledger"
echo ""
