#!/usr/bin/env bash
# =============================================================================
# Deploy Environment Variables to Server (EXAMPLE)
#
# Copy this file to deploy-env-to-server.sh and customize with your server details.
# DO NOT commit the customized version to git!
#
# Usage:
#   cp scripts/deploy-env-to-server.sh.example scripts/deploy-env-to-server.sh
#   # Edit deploy-env-to-server.sh with your server details
#   chmod +x scripts/deploy-env-to-server.sh
#   ./scripts/deploy-env-to-server.sh
# =============================================================================

set -euo pipefail

# CUSTOMIZE THESE VALUES
SERVER="snel-bot"
REMOTE_PATH="/opt/diversifi-api/.env"

echo "🚀 Deploying environment variables to server..."
echo "   Server: $SERVER"
echo "   Remote path: $REMOTE_PATH"
echo ""

# Check if .env.local exists locally
if [ ! -f ".env.local" ]; then
  echo "❌ Error: .env.local file not found in current directory"
  echo "   Please ensure you have a .env.local file with your API keys"
  exit 1
fi

# Check if SYNTH_API_KEY is present
if ! grep -q "SYNTH_API_KEY=" ".env.local"; then
  echo "❌ Error: SYNTH_API_KEY not found in .env.local"
  echo "   Please add SYNTH_API_KEY to your .env.local file"
  exit 1
fi

# Display the SYNTH_API_KEY (masked) for verification
SYNTH_KEY=$(grep "SYNTH_API_KEY=" ".env.local" | cut -d'=' -f2 | tr -d ' "'"'"'')
if [ -z "$SYNTH_KEY" ]; then
  echo "❌ Error: SYNTH_API_KEY is empty in .env.local"
  echo "   Please set a valid SYNTH_API_KEY value"
  exit 1
fi

if [ ${#SYNTH_KEY} -gt 10 ]; then
  MASKED_KEY="${SYNTH_KEY:0:5}***${SYNTH_KEY: -5}"
else
  MASKED_KEY="***"
fi
echo "✅ Found SYNTH_API_KEY: $MASKED_KEY"

# Copy the .env.local file to the server (to temp location first)
echo ""
echo "📤 Copying .env.local to server..."
TEMP_PATH="/tmp/.env.yourapp.tmp"
scp ".env.local" "$SERVER:$TEMP_PATH"

if [ $? -ne 0 ]; then
  echo "❌ Failed to copy .env.local to server"
  exit 1
fi

# Move the file to the final location with sudo
echo "📝 Moving file to final location (requires sudo)..."
ssh "$SERVER" "sudo mv $TEMP_PATH $REMOTE_PATH && sudo chown root:deploy $REMOTE_PATH && sudo chmod 640 $REMOTE_PATH"

if [ $? -eq 0 ]; then
  echo "✅ Successfully deployed .env to server"
  echo "   Remote file: $REMOTE_PATH"
else
  echo "❌ Failed to move .env to final location"
  exit 1
fi

# Verify the file was copied successfully
echo ""
echo "🔍 Verifying remote file..."
ssh "$SERVER" "if [ -f '$REMOTE_PATH' ]; then echo '✅ Remote .env file exists'; else echo '❌ Remote .env file not found'; exit 1; fi"

# Check if the SYNTH_API_KEY is present on the server
echo ""
echo "🔍 Verifying SYNTH_API_KEY on server..."
ssh "$SERVER" "if grep -q 'SYNTH_API_KEY=' '$REMOTE_PATH'; then echo '✅ SYNTH_API_KEY found on server'; else echo '❌ SYNTH_API_KEY not found on server'; exit 1; fi"

echo ""
echo "🎉 Environment deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Restart your app service on the server:"
echo "      ssh $SERVER 'pm2 restart diversifi-api'"
echo "   2. Test your API endpoint:"
echo "      curl https://api.diversifi.famile.xyz/api/trading/market-pulse"
echo ""
echo "💡 The server now has access to all configured API keys"
