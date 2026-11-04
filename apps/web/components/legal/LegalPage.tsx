/**
 * Shared scaffold for the legal pages (terms / privacy / risk / fees).
 *
 * Until counsel approves (NEXT_PUBLIC_LEGAL_APPROVED === 'true') every page
 * carries a noindex robots tag and a visible "Draft — under legal review"
 * banner. Pages are always reachable by URL so counsel can review them.
 */

import Head from 'next/head';
import { RouteLink } from '@/components/shared/RouteLink';
import type { ReactNode } from 'react';

const APPROVED = process.env.NEXT_PUBLIC_LEGAL_APPROVED === 'true';
const LAST_UPDATED = '2026-09-29';

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <Head>
        <title>{`DiversiFi — ${title}`}</title>
        {!APPROVED && <meta name="robots" content="noindex" />}
      </Head>
      <main className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="mx-auto max-w-2xl px-6 py-10">
          {!APPROVED && (
            <div
              role="note"
              className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              Draft — under legal review. Not yet in effect.
            </div>
          )}
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Last updated: {LAST_UPDATED}
          </p>
          <div className="mt-6 space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {children}
          </div>
          <nav
            aria-label="Legal"
            className="mt-10 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400"
          >
            <RouteLink href="/terms" className="underline underline-offset-2">Terms</RouteLink>
            <span aria-hidden="true">·</span>
            <RouteLink href="/privacy" className="underline underline-offset-2">Privacy</RouteLink>
            <span aria-hidden="true">·</span>
            <RouteLink href="/risk" className="underline underline-offset-2">Risk</RouteLink>
            <span aria-hidden="true">·</span>
            <RouteLink href="/fees" className="underline underline-offset-2">Fees</RouteLink>
            <span aria-hidden="true">·</span>
            <RouteLink href="/" className="underline underline-offset-2">DiversiFi</RouteLink>
          </nav>
        </div>
      </main>
    </>
  );
}

/** A `[COUNSEL: …]` placeholder — rendered plainly, impossible to miss. */
export function Counsel({ note }: { note: string }) {
  return (
    <span className="rounded bg-gray-200 px-1 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      [COUNSEL: {note}]
    </span>
  );
}
