#!/usr/bin/env bash
# =============================================================================
# DiversiFi AI API — Hetzner Deployment Script
#
# Deploys the Next.js app to Hetzner as a standalone AI API server.
# Frontend stays on Netlify; all /api/agent/* routes are served from here.
#
# Usage:
#   chmod +x scripts/deploy-hetzner.sh
#   ./scripts/deploy-hetzner.sh
# =============================================================================
set -euo pipefail

DEPLOY_DIR="/opt/diversifi-api"
APP_NAME="diversifi-api"
PORT=6174
REPO="https://github.com/thisyearnofear/diversify.git"
BRANCH="main"

echo "🚀 DiversiFi Hetzner Deploy — $(date)"

# ── 1. Ensure pnpm is available ────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "📦 Installing pnpm..."
  npm install -g pnpm
fi

# ── 2. Clone or pull latest code ────────────────────────────────────────────
if [ -d "$DEPLOY_DIR/.git" ]; then
  echo "🔄 Pulling latest from $BRANCH..."
  cd "$DEPLOY_DIR"
  git fetch origin
  git reset --hard "origin/$BRANCH"
else
  echo "📥 Cloning repo..."
  git clone --branch "$BRANCH" "$REPO" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# ── 3. Verify .env exists ───────────────────────────────────────────────────
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  echo "⚠️  No .env found at $DEPLOY_DIR/.env"
  echo "   Copy .env.example and fill in at minimum:"
  echo "     VENICE_API_KEY=..."
  echo "     GEMINI_API_KEY=..."
  echo "   Then re-run this script."
  exit 1
fi

# ── 4. Install dependencies ─────────────────────────────────────────────────
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# ── 5. Build ─────────────────────────────────────────────────────────────────
echo "🔨 Building..."
PORT=$PORT pnpm build

# ── 6. Start/reload server ──────────────────────────────────────────────────
echo "⚙️  Starting server..."
# Kill any existing next-server processes on our port
pkill -f "next-server.*$PORT" || true
sleep 2

# Start Next.js directly with proper env variables
cd "$DEPLOY_DIR"
nohup sh -c "PORT=$PORT HOSTNAME=127.0.0.1 NODE_ENV=production node_modules/.bin/next start > /var/log/diversifi-api.log 2>&1" &

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 12

# Verify it's running
if ss -tlnp | grep -q ":$PORT "; then
  echo "✅ Server running on port $PORT"
else
  echo "⚠️  Server may not have started correctly. Check /var/log/diversifi-api.log"
fi

echo ""
echo "✅ Deploy complete!"
echo "   API running on http://127.0.0.1:$PORT"
echo "   Nginx proxies https://api.diversifi.famile.xyz → port $PORT"
