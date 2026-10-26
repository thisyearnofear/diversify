/**
 * One place that decides where an API call goes.
 *
 * The API lives on the Hetzner runtime (`api.diversifi.famile.xyz`), not on
 * Vercel. Vercel serves the pages and the edge middleware; every `/api/*`
 * route is executed by the runtime that holds the signer, the warm database
 * connection and the schedule.
 *
 * `NEXT_PUBLIC_API_BASE_URL` is the base. A relative `/api/...` fetch is a
 * request to the *page* origin — which, for the API, is a Vercel lambda.
 * That is the exact split that put ~85 routes on serverless compute, so
 * every client call goes through `apiUrl()`.
 *
 * Server-side code (API routes, scripts) must NOT use this — it is
 * client-only by construction (it reads a NEXT_PUBLIC_ variable), and a
 * server route that reached for the public base would call the box over the
 * network instead of calling the service in-process.
 */

/** The API origin. Empty in local dev, where the Next server serves /api. */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/** Absolute URL for an API path. Pass a path that starts with `/api`. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}
