/**
 * First-party geo plumbing for jurisdiction-aware surfaces.
 *
 * Vercel stamps `x-vercel-ip-country` on every request; the proxy copies
 * it into the `dfi-cc` cookie so client components can read the same
 * signal the edge sees. Server surfaces (getServerSideProps, API routes)
 * read the header directly — the cookie is only a fallback there (and the
 * way to simulate a country in dev: `document.cookie = 'dfi-cc=GB'`).
 *
 * Country only, no IP, nothing persisted beyond the cookie's lifetime.
 * Unknown geo returns null — callers decide whether their feature fails
 * open (thesis: a promotion deny needs a known country) or closed (money
 * features: no cleared market, no feature).
 */

export const GEO_COOKIE = 'dfi-cc';

const ISO2 = /^[A-Za-z]{2}$/;

function readCookieHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === GEO_COOKIE) return v.join('=') || null;
  }
  return null;
}

/** Server-side: request headers → ISO alpha-2 country, or null. */
export function geoCountryFromHeaders(
  headers: Pick<Headers, 'get'> | Record<string, string | string[] | undefined>,
): string | null {
  const get =
    typeof (headers as Pick<Headers, 'get'>).get === 'function'
      ? (k: string) => (headers as Pick<Headers, 'get'>).get(k)
      : (k: string) => {
          const v = (headers as Record<string, string | string[] | undefined>)[k];
          return Array.isArray(v) ? v[0] ?? null : v ?? null;
        };
  const vercel = get('x-vercel-ip-country');
  if (vercel && ISO2.test(vercel)) return vercel.toUpperCase();
  const cookie = readCookieHeader(get('cookie'));
  return cookie && ISO2.test(cookie) ? cookie.toUpperCase() : null;
}

/** Client-side: document.cookie → ISO alpha-2 country, or null. */
export function geoCountryFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  const cookie = readCookieHeader(document.cookie);
  return cookie && ISO2.test(cookie) ? cookie.toUpperCase() : null;
}
