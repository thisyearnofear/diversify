#!/usr/bin/env bash
# =============================================================================
# DiversiFi — Server Health Check
#
# Pings key API endpoints from localhost, measures response times, and writes
# results to /home/deploy/diversifi-api-runtime/health.json for easy access.
#
# Can be run as a cron job (e.g., every 5 minutes):
#   crontab -e
#   */5 * * * * /home/deploy/diversifi-api-runtime/health-check.sh
#
# Manual run:
#   ssh snel-bot 'bash /home/deploy/diversifi-api-runtime/health-check.sh'
# =============================================================================

set -euo pipefail

BASE_URL="http://127.0.0.1:6174"
HEALTH_FILE="/home/deploy/diversifi-api-runtime/health.json"
WORK_DIR="/tmp/diversifi-health.$$"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$WORK_DIR"

# ── Collect raw results as JSON lines ───────────────────────────────────────
RESULTS_FILE="$WORK_DIR/results.jsonl"
ALL_OK="true"  # lowercase string for bash comparisons

for ENDPOINT in "/api/agent/status" "/api/agent/zero-g-ledger" "/api/agent/x402-metrics"; do
    START_TIME=$(date +%s%N)
    RESPONSE_FILE="$WORK_DIR/response.tmp"

    HTTP_CODE=$(curl -s -o "$RESPONSE_FILE" -w '%{http_code}' \
        --max-time 30 "$BASE_URL$ENDPOINT" 2>/dev/null || echo "000")

    END_TIME=$(date +%s%N)
    ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))
    RESPONSE_SIZE=$(wc -c < "$RESPONSE_FILE" 2>/dev/null || echo 0)

    # Check if response is valid JSON
    RESPONSE_VALID="false"
    if python3 -m json.tool "$RESPONSE_FILE" >/dev/null 2>&1; then
        RESPONSE_VALID="true"
    fi

    if [ "$HTTP_CODE" != "200" ] || [ "$RESPONSE_VALID" != "true" ]; then
        ALL_OK="false"
    fi

    # Determine health as a bash variable (lowercase)
    HEALTHY="false"
    if [ "$HTTP_CODE" = "200" ] && [ "$RESPONSE_VALID" = "true" ]; then
        HEALTHY="true"
    fi

    # Write JSON line using python3 with values passed via env vars (no interpolation)
    ENDPOINT_VAL="$ENDPOINT" \
    HTTP_CODE_VAL="$HTTP_CODE" \
    ELAPSED_MS_VAL="$ELAPSED_MS" \
    RESPONSE_SIZE_VAL="$RESPONSE_SIZE" \
    RESPONSE_VALID_VAL="$RESPONSE_VALID" \
    HEALTHY_VAL="$HEALTHY" \
    RESULTS_FILE_VAL="$RESULTS_FILE" \
        python3 -c '
import json, os

result = {
    "endpoint": os.environ["ENDPOINT_VAL"],
    "httpCode": int(os.environ["HTTP_CODE_VAL"]),
    "responseTimeMs": int(os.environ["ELAPSED_MS_VAL"]),
    "responseSizeBytes": int(os.environ["RESPONSE_SIZE_VAL"]),
    "responseValid": os.environ["RESPONSE_VALID_VAL"] == "true",
    "healthy": os.environ["HEALTHY_VAL"] == "true",
}

with open(os.environ["RESULTS_FILE_VAL"], "a") as f:
    f.write(json.dumps(result) + "\n")
'

    rm -f "$RESPONSE_FILE"
done

# ── Build final report from collected results ───────────────────────────────
TIMESTAMP_VAL="$TIMESTAMP" \
ALL_OK_VAL="$ALL_OK" \
RESULTS_FILE_VAL="$RESULTS_FILE" \
HEALTH_FILE_VAL="$HEALTH_FILE" \
HOST_VAL="$(hostname 2>/dev/null || echo 'unknown')" \
    python3 -c '
import json, os

results = []
with open(os.environ["RESULTS_FILE_VAL"]) as f:
    for line in f:
        line = line.strip()
        if line:
            results.append(json.loads(line))

all_healthy = os.environ["ALL_OK_VAL"] == "true"

report = {
    "generatedAt": os.environ["TIMESTAMP_VAL"],
    "allHealthy": all_healthy,
    "okCount": sum(1 for r in results if r.get("healthy")),
    "totalCount": len(results),
    "slowest": max(results, key=lambda r: r["responseTimeMs"])["endpoint"] if results else None,
    "slowestMs": max(r["responseTimeMs"] for r in results) if results else 0,
    "endpoints": results,
    "host": os.environ["HOST_VAL"],
}

with open(os.environ["HEALTH_FILE_VAL"], "w") as f:
    json.dump(report, f, indent=2)

print(f"  All healthy:   {report["allHealthy"]}")
print(f"  OK / Total:    {report["okCount"]}/{report["totalCount"]}")
print(f"  Slowest:       {report["slowest"]} ({report["slowestMs"]}ms)")
for r in results:
    status = "✓" if r["healthy"] else "✗"
    print(f"  {status} {r["endpoint"]:<35} HTTP {r["httpCode"]}  {r["responseTimeMs"]}ms")
'

# ── Clean up ────────────────────────────────────────────────────────────────
rm -rf "$WORK_DIR"
