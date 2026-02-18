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

# ── 6. Create/update PM2 ecosystem ──────────────────────────────────────────
cat > "$DEPLOY_DIR/ecosystem.hetzner.js" <<EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '$DEPLOY_DIR',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT,
      HOSTNAME: '127.0.0.1',
    },
    max_memory_restart: '600M',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    output: '/var/log/diversifi-api-out.log',
    error: '/var/log/diversifi-api-err.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }]
};
EOF

# ── 7. Start/reload with PM2 ────────────────────────────────────────────────
echo "⚙️  Reloading PM2..."
if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 reload "$DEPLOY_DIR/ecosystem.hetzner.js" --update-env
else
  pm2 start "$DEPLOY_DIR/ecosystem.hetzner.js"
fi
pm2 save

echo ""
echo "✅ Deploy complete!"
echo "   API running on http://127.0.0.1:$PORT"
echo "   Nginx should proxy https://api.diversifi.famile.xyz → port $PORT"
echo ""
echo "📋 Next steps if nginx isn't set up yet:"
echo "   sudo cp $DEPLOY_DIR/scripts/nginx-diversifi-api.conf /etc/nginx/sites-available/api.diversifi.famile.xyz"
echo "   sudo ln -sf /etc/nginx/sites-available/api.diversifi.famile.xyz /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo "   sudo certbot --nginx -d api.diversifi.famile.xyz"
