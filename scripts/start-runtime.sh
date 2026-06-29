#!/usr/bin/env bash
# =============================================================================
# DiversiFi runtime bootstrap.
#
# Starts the Next.js standalone build. The deploy script syncs the contents of
# .next/standalone/ to the runtime directory, so server.js and node_modules/
# end up at the root. .next/ (containing static + chunked assets) is also
# synced separately.
#
# --require ./instrument.js installs unhandledRejection / uncaughtException
# handlers that emit structured single-line records to PM2's stderr before
# Next.js's default listeners (which keep emitting full stacks for forensics).
#
# .env lines are eval'd in a subshell with `set -a` so the running process
# inherits them. Only KEY=VALUE lines (no spaces in key) are loaded; a few
# shell-managed keys are skipped to avoid clobbering the current shell.
# =============================================================================
set -euo pipefail

export PORT="${PORT:-6174}"
# Force HOSTNAME to 0.0.0.0 — bash pre-sets HOSTNAME to the system hostname
# (e.g. "ubuntu-4gb-hel1-2"), which makes Next.js bind to 127.0.1.1 instead
# of 0.0.0.0, breaking health checks on 127.0.0.1.
export HOSTNAME="0.0.0.0"
export NODE_ENV="${NODE_ENV:-production}"

cd "$(dirname "$0")"

# Load .env: only lines matching KEY=VALUE (no spaces in key, skip PATH/build vars)
if [ -f .env ]; then
  set -a
  eval "$(sed -n '/^[A-Za-z_][A-Za-z0-9_]*=/{
    /^PATH=/d
    /^CPPFLAGS=/d
    /^LDFLAGS=/d
    /^PKG_CONFIG_PATH=/d
    /^XPC_FLAGS=/d
    /^NVM_CD_FLAGS=/d
    /^SHELL=/d
    /^HOME=/d
    /^USER=/d
    /^TMPDIR=/d
    /^SHLVL=/d
    s/=\(.*\)/="\1"/
    p
  }' .env)"
  set +a
fi

exec node --require ./instrument.js server.js
