/**
 * /fx-drag-calculator — doorway into the Shield instrument's payment-cycle
 * inspector, "Last cycle" mode. The historical engine now lives inside the
 * inspector (one tool, two modes) — this page's job is to land you there,
 * carrying whatever currency memory the visitor already has. Same doorway
 * contract as /rwa-vaults.
 */

import { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CURRENCY_BY_CODE, getCurrencyRisk } from '@/constants/currency-risk';
import { readPaymentCycleDraft, seedPaymentCycleDraft } from '@/hooks/use-payment-cycle';

const TARGET = '/?tab=protect&cycle=last';

export default function FxDragCalculatorDoorway() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    // Preserve currency memory: the saved calculator choice wins, then
    // onboarding's country — but only into an empty draft, never over one.
    try {
      if (!readPaymentCycleDraft().localCurrency) {
        const saved = localStorage.getItem('fx-drag-currency');
        const remembered = saved && CURRENCY_BY_CODE[saved] ? saved : null;
        const country = localStorage.getItem('user-country-code');
        const fromCountry = country ? getCurrencyRisk(country)?.code : null;
        const code = remembered ?? (fromCountry && fromCountry !== 'USD' && CURRENCY_BY_CODE[fromCountry] ? fromCountry : null);
        if (code) seedPaymentCycleDraft({ localCurrency: code });
      }
    } catch { /* ignore */ }
    void router.replace(TARGET);
  }, [router.isReady, router]);

  return (
    <>
      <Head>
        <title>FX Drag Calculator — see what currency timing costs your business</title>
        <meta name="description" content="Free FX drag report for import businesses. Enter your numbers, see exactly how much currency conversion costs you per cycle." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
            Opening the FX drag report inside DiversiFi…
          </p>
          <Link
            href={TARGET}
            className="mt-4 inline-block text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open it now →
          </Link>
        </div>
      </div>
    </>
  );
}
