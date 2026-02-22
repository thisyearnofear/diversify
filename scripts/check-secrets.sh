#!/bin/bash

# check-secrets.sh
# Scans staged files for potential secrets (private keys, API keys, etc.)
# Intended to be used as a pre-commit hook or CI step.

# ANSI Color Codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure we are in a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Not inside a git repository."
    exit 0
fi

echo "🔒 Scanning staged files for secrets..."

SECRETS_FOUND=0

# ------------------------------------------------------------------------------
# 1. Check for sensitive filenames (e.g. .env, .pem)
# ------------------------------------------------------------------------------
# Get list of Added, Copied, or Modified files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [[ -z "$STAGED_FILES" ]]; then
    echo "No files staged to check."
    exit 0
fi

# Regex for filenames that should generally be ignored/not committed
SENSITIVE_FILE_PATTERN="(\.env|\.pem|\.key|\.p12|\.pfx)$"

for file in $STAGED_FILES; do
    if [[ "$file" =~ $SENSITIVE_FILE_PATTERN ]]; then
        # Allow example/template files
        if [[ "$file" != *".example"* ]] && [[ "$file" != *".template"* ]] && [[ "$file" != *".local.example"* ]]; then
            echo -e "${RED}❌ Sensitive file detected: $file${NC}"
            SECRETS_FOUND=1
        fi
    fi
done

# ------------------------------------------------------------------------------
# 2. Check content of staged changes for secret patterns
# ------------------------------------------------------------------------------
# We capture the diff of staged changes (added lines only)
DIFF_CONTENT=$(git diff --cached --diff-filter=ACM)

# Helper function to check regex against added lines
check_regex() {
    local pattern="$1"
    local name="$2"

    # Grep for lines starting with '+' (added lines) matching the pattern
    # -q suppresses output, we just check exit code
    if echo "$DIFF_CONTENT" | grep -E "^\\+" | grep -qE -e "$pattern"; then
        echo -e "${RED}❌ Potential $name found in staged changes!${NC}"
        # Show the matching line (highlighted)
        echo "$DIFF_CONTENT" | grep -E "^\\+" | grep -E --color=always -e "$pattern"
        SECRETS_FOUND=1
    fi
}

# --- Patterns ---

# Private Key Blocks (RSA, OpenSSH, etc.)
check_regex "-----BEGIN (RSA|DSA|EC|OPENSSH|PRIVATE) KEY" "Private Key Header"

# Ethereum/Crypto Private Keys
# Looks for variable assignments like: PRIVATE_KEY = "0x..."
# Matches 64-char hex strings
check_regex "(PRIVATE_KEY|privateKey|PRIV_KEY|WALLET_KEY).*[:=]\s*['\"]?(0x)?[0-9a-fA-F]{64}['\"]?" "Private Key"

# Mnemonic Phrases
# Matches variable assignment to a string containing at least 12 words
check_regex "(MNEMONIC|mnemonic|SEED_PHRASE).*[:=]\s*['\"].*([a-z]{3,}\s+){11,}[a-z]{3,}.*['\"]" "Mnemonic Phrase"

# AWS Access Key ID
# AKIA followed by 16 alphanumeric characters
check_regex "AKIA[0-9A-Z]{16}" "AWS Access Key"

# Google API Key
# Starts with AIza, followed by 35 characters
check_regex "AIza[0-9A-Za-z\\-_]{35}" "Google API Key"

# Stripe Secret Key
# Starts with sk_live_
check_regex "sk_live_[0-9a-zA-Z]{24}" "Stripe Secret Key"

# Slack Token
check_regex "xox[baprs]-([0-9a-zA-Z]{10,48})" "Slack Token"

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------

if [[ $SECRETS_FOUND -eq 1 ]]; then
    echo ""
    echo -e "${RED}⛔ Commit rejected: Potential secrets detected.${NC}"
    echo -e "${YELLOW}To bypass this check (only if false positive):${NC}"
    echo "  git commit --no-verify"
    exit 1
fi

echo -e "${GREEN}✅ No secrets detected.${NC}"
exit 0
