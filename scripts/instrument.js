/**
 * Production runtime instrument for diversifi-api.
 *
 * Loaded via `node --require ./instrument.js server.js` from start-runtime.sh.
 *
 * Two responsibilities, in order:
 *   1. Validate required env vars (via ./required-env.js). This runs first
 *      and exits the process if anything critical is missing in production.
 *      Why first? We want a missing secret to surface as "process did not
 *      start" rather than as a 500 on the first request.
 *   2. Install structured logging for unhandled promise rejections and
 *      uncaught exceptions so they show up in PM2's stderr as single-line,
 *      parseable records. Next.js's own default listeners stay in place and
 *      continue to emit their verbose stacks for forensics — this adds a
 *      single summary line on top so a log scraper can alert without
 *      parsing a multi-line stack.
 *
 * Why --require and not just `require()` at the top of server.js?
 * server.js is a Next.js standalone build artifact (auto-generated from
 * .next/standalone/server.js). Editing it directly would be lost on the
 * next `next build`. --require runs *before* any other code in the
 * process, which is what we need to catch the earliest rejections.
 */

require("./required-env");

const MAX_STACK_LINES = 5;
const MAX_ERROR_NAME = 80;
const MAX_ERROR_MESSAGE = 500;

function truncate(str, max) {
  if (typeof str !== "string") return String(str);
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function summarise(err) {
  if (err instanceof Error) {
    return {
      name: truncate(err.name || "Error", MAX_ERROR_NAME),
      message: truncate(err.message || "", MAX_ERROR_MESSAGE),
      stack: err.stack ? err.stack.split("\n").slice(0, MAX_STACK_LINES).join("\n") : "",
    };
  }
  // Non-Error rejection (e.g. `Promise.reject("string")`)
  return {
    name: "NonError",
    message: truncate(typeof err === "string" ? err : JSON.stringify(err), MAX_ERROR_MESSAGE),
    stack: "",
  };
}

process.on("unhandledRejection", (reason) => {
  const s = summarise(reason);
  console.error(
    `[INSTRUMENT] unhandledRejection at ${new Date().toISOString()} ` +
      `pid=${process.pid} name=${s.name} message=${JSON.stringify(s.message)}`
  );
  if (s.stack) {
    console.error(`[INSTRUMENT]   stack[0..${MAX_STACK_LINES}]:\n${s.stack}`);
  }
});

// uncaughtException: process state is corrupt. Log and exit so PM2
// restarts us. We don't try to "recover" — the conventional guidance
// (https://nodejs.org/api/process.html#warning-using-uncaughtexception-correctly)
// is that continuing after an uncaught exception is undefined behavior.
process.on("uncaughtException", (err) => {
  const s = summarise(err);
  console.error(
    `[INSTRUMENT] uncaughtException at ${new Date().toISOString()} ` +
      `pid=${process.pid} name=${s.name} message=${JSON.stringify(s.message)}`
  );
  if (s.stack) {
    console.error(`[INSTRUMENT]   stack[0..${MAX_STACK_LINES}]:\n${s.stack}`);
  }
  // Give stdout/stderr a moment to flush before exiting.
  setTimeout(() => process.exit(1), 250);
});
