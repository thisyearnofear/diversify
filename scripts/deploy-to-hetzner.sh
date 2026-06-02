#!/usr/bin/env bash
# =============================================================================
# DiversiFi — Local Build → Hetzner Deploy
#
# Builds the Next.js project LOCALLY (your Mac/CI), then rsyncs only the
# compiled .next/ output to the Hetzner runtime directory. This keeps the
# server lean — no git clone, no node_modules, no build tools needed.
#
# Deploy safety pipeline (added 2026-06 after env-drift incident):
#   1. Drift-check .env.local against scripts/required-env.json BEFORE
#      anything leaves the laptop. A missing required var fails the deploy
#      at this stage, not at runtime.
#   2. Snapshot the server's current .next/ + .env to .next.bak-latest/
#      so we can roll back if the gate fails.
#   3. Rsync the new build + scripts + (optionally) env.
#   4. Restart PM2.
#   5. Gate on /api/healthz — if the process is up but the new build is
#      broken (or required env is missing and required-env.js exited the
#      process at boot), healthz will return 503. The deploy then rolls
#      back from the snapshot, restarts, and exits non-zero.
#
# Usage:
#   chmod +x scripts/deploy-to-hetzner.sh
#   ./scripts/deploy-to-hetzner.sh
#
# Environment variables (optional overrides):
#   DEPLOY_SSH_ALIAS    SSH alias for Hetzner (default: snel-bot)
#   DEPLOY_RUNTIME_DIR  Runtime path on server (default: /home/deploy/diversifi-api-runtime)
#   DEPLOY_APP_NAME     PM2 app name (default: diversifi-api)
#   DEPLOY_SKIP_BUILD   Set to "true" to skip the local build step
#   DEPLOY_SYNC_ENV     Set to "true" to also sync .env.local to the server
#   DEPLOY_HEALTH_URL   URL to gate on (default: http://127.0.0.1:6174/api/healthz)
#   DEPLOY_SKIP_GATE    Set to "true" to skip the post-deploy healthz gate
#                       (use only for emergency deploys; you take the risk)
#
# Prerequisites:
#   - SSH alias configured in ~/.ssh/config
#   - pnpm installed locally
#   - jq installed locally (for check-env-drift.sh)
#   - Project dependencies installed (pnpm install)
# =============================================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
REMOTE="${DEPLOY_SSH_ALIAS:-snel-bot}"
RUNTIME_DIR="${DEPLOY_RUNTIME_DIR:-/home/deploy/diversifi-api-runtime}"
APP_NAME="${DEPLOY_APP_NAME:-diversifi-api}"
SKIP_BUILD="${DEPLOY_SKIP_BUILD:-false}"
SYNC_ENV="${DEPLOY_SYNC_ENV:-false}"
SKIP_GATE="${DEPLOY_SKIP_GATE:-false}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:6174/api/healthz}"
PUBLIC_HEALTH_URL="https://api.diversifi.famile.xyz/api/healthz"

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
info "Sync env:      $SYNC_ENV"
info "Health gate:   $([ "$SKIP_GATE" = "true" ] && echo "SKIPPED" || echo "ENABLED")"
echo ""

# ── 0. Drift check (block the deploy if .env.local is missing required vars) ─
# This runs BEFORE the build so we fail fast on the cheapest operation.
# It only enforces drift if SYNC_ENV=true, since otherwise the deploy is
# code-only and env drift isn't the deploy's concern.
if [ "$SYNC_ENV" = "true" ]; then
    info "Running pre-deploy env drift check (.env.local → required-env.json)..."
    if ! ./scripts/check-env-drift.sh .env.local; then
        fail "env drift detected. Fix .env.local and re-run."
    fi
    ok "env drift check passed"
else
    info "Skipping env drift check (SYNC_ENV=false; env is not being changed by this deploy)"
fi
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

# ── 3. Snapshot server state for rollback ───────────────────────────────────
# Keep the previous build (and env, if we manage it) so a failed healthz gate
# can restore them. This is the deploy's safety net.
SNAPSHOT_DIR="$RUNTIME_DIR.bak-latest"
info "Snapshotting current server state to $(basename "$SNAPSHOT_DIR")..."
# If the previous deploy compressed its snapshot, decompress it first so
# we have the uncompressed directory to base the snapshot on.
ssh "$REMOTE" "if [ -f '$RUNTIME_DIR/.next.bak-latest.tar.gz' ]; then tar xzf '$RUNTIME_DIR/.next.bak-latest.tar.gz' -C '$RUNTIME_DIR'; fi" 2>/dev/null || true
# Remove the previous uncompressed snapshot (if any) and create a fresh one
ssh "$REMOTE" "rm -rf '$SNAPSHOT_DIR' && mkdir -p '$SNAPSHOT_DIR'"
# Copy the current .next/ and .env (if present). This runs ON THE SERVER so
# it doesn't tax the local machine or the network. The standalone bundle
# sits at $RUNTIME_DIR/.next/ so we copy that whole tree.
ssh "$REMOTE" "[ -d '$RUNTIME_DIR/.next' ] && cp -a '$RUNTIME_DIR/.next' '$SNAPSHOT_DIR/.next' || true"
ssh "$REMOTE" "[ -f '$RUNTIME_DIR/.env' ] && cp -a '$RUNTIME_DIR/.env' '$SNAPSHOT_DIR/.env' || true"
ssh "$REMOTE" "[ -f '$RUNTIME_DIR/.env.local' ] && cp -a '$RUNTIME_DIR/.env.local' '$SNAPSHOT_DIR/.env.local' || true"
# Remove the old compressed archive now that we have an uncompressed snapshot
ssh "$REMOTE" "rm -f '$RUNTIME_DIR/.next.bak-latest.tar.gz'" 2>/dev/null || true
ok "snapshot taken"

# ── 4. Rsync standalone build to Hetzner runtime dir ────────────────────────
if [ ! -f ".next/standalone/server.js" ]; then
    fail "Standalone output not found at .next/standalone/server.js — ensure next.config uses output: 'standalone'"
fi

info "Syncing standalone build to $REMOTE:$RUNTIME_DIR/ ..."

LOCAL_SIZE=$(du -sh .next/standalone 2>/dev/null | cut -f1)
info "Local standalone size: $LOCAL_SIZE"

# Sync the standalone server, excluding server-managed files that must not be
# overwritten (env vars, startup script, instrument). --delete removes stale
# build files.
rsync -az --delete --no-owner --no-group \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='start-runtime.sh' \
    --exclude='instrument.js' \
    --exclude='required-env.js' \
    .next/standalone/ \
    "$REMOTE:$RUNTIME_DIR/" 2>&1 | tail -5

# Static assets live inside .next/static/ which standalone doesn't include
info "Syncing static assets..."
rsync -az --delete --no-owner --no-group \
    .next/static/ \
    "$REMOTE:$RUNTIME_DIR/.next/static/" 2>&1 | tail -3

ok "Rsync complete"

# ── 5. Optionally sync .env.local ───────────────────────────────────────────
if [ "$SYNC_ENV" = "true" ]; then
    if [ -f ".env.local" ]; then
        info "Syncing .env.local → $RUNTIME_DIR/.env on server..."
        scp ".env.local" "$REMOTE:$RUNTIME_DIR/.env"
        ok "Environment synced"
    else
        warn ".env.local not found locally — skipping env sync"
    fi
fi

# ── 6. Sync start-runtime.sh + instrument.js + required-env.js (always) ─────
# These are the runtime entry point and pre-required modules. All three ship
# from the repo on every deploy so handler changes don't get stuck behind an
# `if [ -f ]` guard.
info "Syncing scripts/start-runtime.sh..."
scp "scripts/start-runtime.sh" "$REMOTE:$RUNTIME_DIR/start-runtime.sh"
ssh "$REMOTE" "chmod +x $RUNTIME_DIR/start-runtime.sh"
ok "start-runtime.sh synced"

info "Syncing scripts/instrument.js..."
scp "scripts/instrument.js" "$REMOTE:$RUNTIME_DIR/instrument.js"
ok "instrument.js synced"

info "Syncing scripts/required-env.js (and required-env.json)..."
scp "scripts/required-env.js" "$REMOTE:$RUNTIME_DIR/required-env.js"
scp "scripts/required-env.json" "$REMOTE:$RUNTIME_DIR/required-env.json"
ok "required-env synced"

# ── 7. Restart PM2 ──────────────────────────────────────────────────────────
info "Restarting PM2 ($APP_NAME)..."
ssh "$REMOTE" "pm2 restart $APP_NAME --update-env" || {
    warn "PM2 restart failed — trying to start fresh"
    ssh "$REMOTE" "pm2 start $RUNTIME_DIR/start-runtime.sh --name $APP_NAME --interpreter bash"
}

# Wait for the server to stabilize
info "Waiting for PM2 to come back online (up to 30s)..."
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
else
    warn "PM2 did not reach 'online' after 30s — the healthz gate below will catch the failure"
fi

# ── 8. Post-deploy healthz gate ─────────────────────────────────────────────
# This is the load-bearing safety net. If the new build is broken (compile
# succeeded but runtime fails), the boot validator caught a missing env, or
# the process is up but degraded, /api/healthz returns 503 and we roll back.
if [ "$SKIP_GATE" = "true" ]; then
    warn "Skipping healthz gate (DEPLOY_SKIP_GATE=true). You are on your own."
else
    info "Gating on $PUBLIC_HEALTH_URL (up to 30s, 3 attempts)..."
    HEALTH_OK=false
    LAST_BODY=""
    for attempt in 1 2 3; do
        sleep 5  # give the new process a moment to bind the port
        HTTP_CODE=$(ssh "$REMOTE" "curl -s -o /tmp/healthz-resp.json -w '%{http_code}' --max-time 15 '$HEALTH_URL' 2>&1" || echo "000")
        LAST_BODY=$(ssh "$REMOTE" "cat /tmp/healthz-resp.json 2>/dev/null" || echo "")
        if [ "$HTTP_CODE" = "200" ]; then
            HEALTH_OK=true
            break
        fi
        warn "healthz attempt $attempt: HTTP $HTTP_CODE"
    done

    if [ "$HEALTH_OK" = "true" ]; then
        ok "healthz gate passed: HTTP 200"
        # Show a compact status line so the deploy log is self-documenting
        echo "$LAST_BODY" | jq -c '.status as $s | "  ↳ status=\($s) checks: mongo=\(.checks.mongo.ok) venice=\(.checks.venice.ok) intelligence=\(.checks.intelligence.ok)"' 2>/dev/null || true
    else
        err() { echo -e "${RED}✗${NC} $1"; }
        err "healthz gate FAILED after 3 attempts"
        err "response: $LAST_BODY"
        err "rolling back from snapshot..."
        ssh "$REMOTE" "rm -rf '$RUNTIME_DIR/.next' '$RUNTIME_DIR/.env' '$RUNTIME_DIR/.env.local' 2>/dev/null; cp -a '$SNAPSHOT_DIR/.next' '$RUNTIME_DIR/.next' 2>/dev/null; cp -a '$SNAPSHOT_DIR/.env' '$RUNTIME_DIR/.env' 2>/dev/null; cp -a '$SNAPSHOT_DIR/.env.local' '$RUNTIME_DIR/.env.local' 2>/dev/null; true"
        ssh "$REMOTE" "pm2 restart $APP_NAME --update-env" || true
        sleep 5
        # Re-verify the rolled-back state is actually healthy before exiting
        RECOVERY_CODE=$(ssh "$REMOTE" "curl -s -o /dev/null -w '%{http_code}' --max-time 15 '$HEALTH_URL' 2>&1" || echo "000")
        if [ "$RECOVERY_CODE" = "200" ]; then
            err "rollback succeeded — service is healthy again on the previous build"
        else
            err "rollback did NOT restore health (HTTP $RECOVERY_CODE). Manual intervention required."
            ssh "$REMOTE" "pm2 logs $APP_NAME --lines 25 --nostream 2>&1 | tail -20" || true
        fi
        exit 1
    fi
fi

# ── 9. Verify additional endpoints (legacy smoke) ───────────────────────────
info "Verifying /api/agent/status endpoint..."
HTTP_CODE=$(ssh "$REMOTE" "curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:6174/api/agent/status 2>&1" || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    ok "/api/agent/status: HTTP $HTTP_CODE"
else
    warn "/api/agent/status returned HTTP $HTTP_CODE"
fi

info "Verifying /api/agent/x402-metrics endpoint..."
X402_CODE=$(ssh "$REMOTE" "curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://127.0.0.1:6174/api/agent/x402-metrics 2>&1" || echo "000")
if [ "$X402_CODE" = "200" ]; then
    ok "x402-metrics: HTTP $X402_CODE"
else
    warn "x402-metrics returned HTTP $X402_CODE"
fi

# ── 10. Compress snapshot to save disk ──────────────────────────────────────
# The snapshot is only needed if the healthz gate fails. Once the deploy
# succeeds, compress it to reclaim ~36 MB. If a rollback IS needed, the
# deploy script will decompress it automatically on the next deploy.
info "Compressing snapshot to save disk..."
ssh "$REMOTE" "cd '$RUNTIME_DIR' && tar czf '.next.bak-latest.tar.gz' -C '$(dirname "$SNAPSHOT_DIR")' '$(basename "$SNAPSHOT_DIR")' 2>/dev/null && rm -rf '$SNAPSHOT_DIR' && ls -lh '.next.bak-latest.tar.gz'" || warn "Snapshot compression skipped (non-fatal)"
ok "snapshot compressed"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy complete!                                           ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
info "Health:   $PUBLIC_HEALTH_URL"
info "API:      https://api.diversifi.famile.xyz/api/agent/status"
info "Metrics:  https://api.diversifi.famile.xyz/api/agent/x402-metrics"
info "Ledger:   https://api.diversifi.famile.xyz/api/agent/zero-g-ledger"
echo ""
info "Compressed snapshot (for manual rollback if needed): $RUNTIME_DIR/.next.bak-latest.tar.gz"
info "To roll back manually:"
info "  ssh $REMOTE 'cd $RUNTIME_DIR && tar xzf .next.bak-latest.tar.gz && pm2 restart $APP_NAME'"
echo ""
