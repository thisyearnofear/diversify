#!/usr/bin/env bash
# =============================================================================
# DiversiFi — Hetzner Deployment Script
#
# Builds locally, rsyncs artifacts to Hetzner, restarts PM2.
# NEVER builds on the server — next build uses ~48% RAM on the VPS.
#
# Usage (from project root):
#   chmod +x scripts/deploy-hetzner.sh
#   ./scripts/deploy-hetzner.sh
#
# Prerequisites:
#   - SSH alias "snel-bot" configured in ~/.ssh/config
#   - rsync installed locally
# =============================================================================
set -euo pipefail

REMOTE="snel-bot"
DEPLOY_DIR="/opt/diversifi-api"
APP_NAME="diversifi-api"

echo "🚀 DiversiFi Hetzner Deploy — $(date)"

# ── 1. Build locally ─────────────────────────────────────────────────────────
echo "🔨 Building locally (keeps server RAM free)..."
pnpm run build

# ── 2. Rsync build artifacts ─────────────────────────────────────────────────
echo "📦 Syncing .next/standalone → Hetzner..."
rsync -az --delete .next/standalone/ "$REMOTE:$DEPLOY_DIR/.next/standalone/"

echo "📦 Syncing .next/static → Hetzner..."
rsync -az --delete .next/static/ "$REMOTE:$DEPLOY_DIR/.next/static/"

echo "📦 Syncing public/ → Hetzner..."
rsync -az public/ "$REMOTE:$DEPLOY_DIR/public/"

# ── 2.1. Cleanup build artifacts on server (safety net) ─────────────────────
echo "🧹 Cleaning up build artifacts on server..."
ssh "$REMOTE" "
  rm -rf $DEPLOY_DIR/node_modules 2>/dev/null || true
  rm -rf $DEPLOY_DIR/.next/cache 2>/dev/null || true
  rm -rf $DEPLOY_DIR/.turbo 2>/dev/null || true
  rm -rf $DEPLOY_DIR/packages 2>/dev/null || true
"

# ── 3. Restart PM2 ───────────────────────────────────────────────────────────
echo "🔄 Restarting PM2 process..."
ssh "$REMOTE" "pm2 restart $APP_NAME && sleep 2 && pm2 list | grep $APP_NAME"

echo ""
echo "✅ Deploy complete!"
echo "   API running on http://127.0.0.1:6174"
echo "   Proxied via nginx → https://api.diversifi.famile.xyz"
