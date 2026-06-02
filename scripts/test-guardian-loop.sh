#!/usr/bin/env bash
# =============================================================================
# Live smoke test for the post-sunset Guardian-loop endpoint.
#
# Hits the running /api/agent/guardian-loop with the cron secret and verifies:
#   - 200 status
#   - response shape (success/timestamp/permissionsChecked/executions*/results)
#   - no error field
#   - no exception in the post-sunset code path
#
# The endpoint only auto-executes if a user has an active GUARDIAN-tier
# permission with a pending recommendation. In normal conditions (no users
# have ERC-7715 sessions yet) the loop returns permissionsChecked:0, which
# is the expected quiet state. This test confirms the loop *runs* without
# crashing on the post-sunset code paths (no synth forecasts, no
# missing fields).
#
# Usage:
#   ./scripts/test-guardian-loop.sh
#   SECRET=... ./scripts/test-guardian-loop.sh https://api.diversifi.famile.xyz
#
# IMPORTANT: this script does NOT default GUARDIAN_LOOP_SECRET. The secret
# was previously hardcoded as a fallback here, but committing that value to
# the public repo would expose the cron endpoint to anyone who reads the
# source. Now the operator must explicitly provide the secret:
#   - $SECRET (preferred), or
#   - $GUARDIAN_LOOP_SECRET from your local .env.local
# =============================================================================
set -euo pipefail

URL="${1:-${GUARDIAN_LOOP_URL:-https://api.diversifi.famile.xyz}}"
SECRET="${SECRET:-${GUARDIAN_LOOP_SECRET:-}}"

if [ -z "$SECRET" ]; then
    echo "error: GUARDIAN_LOOP_SECRET is required" >&2
    echo "  set it in your local .env.local, or pass SECRET=... to this script" >&2
    exit 1
fi

info() { printf "\033[1;34m▸\033[0m %s\n" "$*"; }
ok() { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m✗\033[0m %s\n" "$*" >&2; exit 1; }

info "POST $URL/api/agent/guardian-loop"
START=$(date +%s)
HTTP_CODE=$(curl -sS -o /tmp/guardian-loop-resp.json -w "%{http_code}" \
    -X POST -H "content-type: application/json" \
    -H "x-guardian-secret: $SECRET" \
    --max-time 30 \
    "$URL/api/agent/guardian-loop" || echo "000")
END=$(date +%s)
DURATION=$((END - START))

info "HTTP $HTTP_CODE in ${DURATION}s"
[ "$HTTP_CODE" = "200" ] || err "expected 200, got $HTTP_CODE"

# Validate response shape
HAS_SUCCESS=$(jq -r '.success // "missing"' /tmp/guardian-loop-resp.json)
HAS_TIMESTAMP=$(jq -r '.timestamp // "missing"' /tmp/guardian-loop-resp.json)
HAS_PERMS_CHECKED=$(jq -r '.permissionsChecked // "missing"' /tmp/guardian-loop-resp.json)
HAS_ERROR=$(jq -r 'has("error") | tostring' /tmp/guardian-loop-resp.json)
RESULTS_LEN=$(jq -r '.results | length' /tmp/guardian-loop-resp.json)

[ "$HAS_SUCCESS" != "missing" ] || err "missing 'success' field"
[ "$HAS_TIMESTAMP" != "missing" ] || err "missing 'timestamp' field"
[ "$HAS_PERMS_CHECKED" != "missing" ] || err "missing 'permissionsChecked' field"
[ "$HAS_ERROR" = "false" ] || err "response has 'error' field"

ok "success=$HAS_SUCCESS timestamp=$HAS_TIMESTAMP permissionsChecked=$HAS_PERMS_CHECKED results=$RESULTS_LEN"

# Stale-recommendation path detection: if any result has status="error" with a
# "synth" mention, the post-sunset code path leaked. (No synth calls in the
# loop, but SynthDataService could be referenced from somewhere we forgot.)
if jq -r '.results[]? | select(.status=="error") | .reason' /tmp/guardian-loop-resp.json 2>/dev/null | grep -qi synth; then
    err "found a Synth error in results — sunset regression"
fi

ok "no Synth regressions in response"
info "smoke test passed"
