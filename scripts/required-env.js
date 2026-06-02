/**
 * Boot-time required-env validator.
 *
 * Required by scripts/instrument.js (which is loaded via `node --require` in
 * start-runtime.sh) so it runs BEFORE any application code, BEFORE the
 * process binds a port, and BEFORE Next.js has set up any listeners.
 *
 * If a required variable is missing in production, this exits the process
 * with code 1. PM2 then sees the process as errored and surfaces that state
 * through `/api/healthz` and the rest of the monitoring surface. We
 * deliberately fail LOUD at boot rather than silently 500 at first request.
 *
 * In development (NODE_ENV !== 'production') we only WARN, so local dev
 * without all keys (e.g. running `next dev` to test a single feature) still
 * works.
 *
 * Single source of truth for the required list is scripts/required-env.json,
 * also read by scripts/check-env-drift.sh.
 */

const fs = require("node:fs");
const path = require("node:path");

const CONFIG_PATH = path.resolve(__dirname, "required-env.json");

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(
      `[REQUIRED-ENV] Config file missing at ${CONFIG_PATH}. ` +
      `Refusing to start.`
    );
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (err) {
    console.error(
      `[REQUIRED-ENV] Config file at ${CONFIG_PATH} is not valid JSON: ${err.message}`
    );
    process.exit(1);
  }
}

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function check() {
  const isProd = process.env.NODE_ENV === "production";
  const config = loadConfig();
  const required = config.required || [];
  const oneOfGroups = config.oneOf || [];
  const expectedValues = config.expectedValues || {};

  const missing = required.filter((key) => isEmpty(process.env[key]));

  const noOneOfGroupSatisfied = oneOfGroups.length > 0
    && !oneOfGroups.some((group) => group.every((key) => !isEmpty(process.env[key])))
    ? oneOfGroups
    : [];

  const valueMismatches = [];
  for (const [key, allowedValues] of Object.entries(expectedValues)) {
    if (isEmpty(process.env[key])) continue; // already counted in `missing`
    if (!allowedValues.includes(process.env[key])) {
      valueMismatches.push({ key, actual: process.env[key], allowed: allowedValues });
    }
  }

  const hasErrors = missing.length > 0 || noOneOfGroupSatisfied.length > 0 || valueMismatches.length > 0;

  if (!hasErrors) {
    if (isProd) {
      console.log(`[REQUIRED-ENV] ✓ All ${required.length} required vars present (production mode).`);
    }
    return;
  }

  const log = isProd ? console.error : console.warn;
  const prefix = isProd ? "[REQUIRED-ENV]" : "[REQUIRED-ENV WARN]";

  if (missing.length > 0) {
    log(`${prefix} Missing required env vars: ${missing.join(", ")}`);
  }
  if (noOneOfGroupSatisfied.length > 0) {
    log(`${prefix} None of the following groups are fully satisfied:`);
    for (const group of noOneOfGroupSatisfied) {
      log(`  - all of: ${group.join(", ")}`);
    }
  }
  for (const m of valueMismatches) {
    log(`${prefix} ${m.key}=${JSON.stringify(m.actual)} but must be one of: ${m.allowed.join(", ")}`);
  }

  if (isProd) {
    log(`${prefix} Set them in /home/deploy/diversifi-api-runtime/.env and restart.`);
    log(`${prefix} Aborting startup to prevent silent 500s.`);
    process.exit(1);
  } else {
    log(`${prefix} Continuing in non-production mode (NODE_ENV=${process.env.NODE_ENV || "unset"}).`);
  }
}

check();
