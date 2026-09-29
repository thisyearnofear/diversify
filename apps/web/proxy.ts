import { NextRequest, NextResponse } from 'next/server';
import { isBlockedLocation } from '@diversifi/shared/src/config/jurisdictions';

/**
 * Compliance geo-block. Next 16 renamed middleware to proxy (Node runtime).
 * Vercel stamps `x-vercel-ip-country` / `x-vercel-ip-country-region` on every
 * request; comprehensively sanctioned locations get a 451 rewrite to
 * /restricted. Country only — no IP, nothing persisted.
 *
 * Everything not on the exempt list is gated, API routes included: a blocked
 * user shouldn't reach the product through the JSON door either.
 */

// Legal/infra surfaces stay reachable — counsel and crawlers must be able to
// read the terms even where the product itself is closed.
const EXEMPT_PATHS = new Set(['/restricted', '/terms', '/privacy', '/risk', '/fees']);

function isExempt(pathname: string): boolean {
  if (EXEMPT_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/_next')) return true;
  // Static files and favicons: anything carrying a file extension.
  if (pathname.includes('.')) return true;
  return false;
}

export interface GeoDecision {
  blocked: boolean;
  country: string | null;
  region: string | null;
}

/** Pure decision — exported for tests. Headers are the raw geo pair. */
export function decideGeo(
  headers: Pick<Headers, 'get'>,
  pathname: string,
): GeoDecision {
  const country = headers.get('x-vercel-ip-country');
  const region = headers.get('x-vercel-ip-country-region');
  if (isExempt(pathname)) return { blocked: false, country, region };
  return { blocked: isBlockedLocation(country, region), country, region };
}

export function proxy(request: NextRequest): NextResponse {
  const { blocked, country, region } = decideGeo(
    request.headers,
    request.nextUrl.pathname,
  );
  if (!blocked) return NextResponse.next();

  // One structured line per blocked request; declines are recorded, not
  // hidden — but no IP is ever logged.
  console.warn('[compliance] geo_block', {
    country,
    region,
    path: request.nextUrl.pathname,
  });

  const url = request.nextUrl.clone();
  url.pathname = '/restricted';
  // 451 Unavailable For Legal Reasons.
  return NextResponse.rewrite(url, { status: 451 });
}

export const config = {
  // Skip static/framework assets at the edge — the Node proxy shouldn't run
  // on every chunk and image. Path-level exemptions (legal pages, etc.)
  // stay in isExempt as the belt; API routes still match.
  matcher:
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml|webmanifest|riv|woff|woff2|map)$).*)',
};
