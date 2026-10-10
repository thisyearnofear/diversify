/**
 * Guardarian partner-integration helpers.
 *
 * Guardarian has no anonymous widget — every entry point requires partner
 * credentials, so URL construction lives behind /api/onramp/guardarian-url
 * where the secrets stay. Two credential levels are supported:
 *
 *   - GUARDARIAN_PARTNER_ID + GUARDARIAN_PRIVATE_KEY (RSA private key whose
 *     public half is registered with Guardarian) → Calculator v2 widget,
 *     embeddable in an iframe.
 *   - GUARDARIAN_PARTNER_API_TOKEN → payments.guardarian.com transaction
 *     link, opened in a new tab.
 *
 * Docs: https://docs.guardarian.com (checkout/widget, transaction-link).
 */

export interface GuardDestination {
  ticker: string;
  network: string;
}

/**
 * App symbol → Guardarian {ticker, network}, verified against the live
 * GET /v1/currencies response (2026-10): USDC sells on CELO/ARBITRUM/ETH/…,
 * CELO sells on CELO, USDT sells on CELO — cUSD is NOT listed, so stable
 * shortfalls on Celo fall back to USDC (bridgeable, same chain).
 */
export function guardDestinationFor(
  symbol: string | null | undefined,
  chainId: number | null | undefined,
): GuardDestination {
  const s = (symbol ?? "").toUpperCase();
  switch (s) {
    case "CELO":
      return { ticker: "CELO", network: "CELO" };
    case "USDT":
      return { ticker: "USDT", network: "CELO" };
    case "USDC":
      return { ticker: "USDC", network: chainId === 42161 ? "ARBITRUM" : "CELO" };
    default:
      // Anything Guardarian doesn't list (USDm/KESm/…) → USDC on the
      // user's chain so the funds land somewhere bridgeable, never a
      // ticker the checkout would silently ignore.
      return { ticker: "USDC", network: chainId === 42161 ? "ARBITRUM" : "CELO" };
  }
}

export const GUARD_CALC_V2 = "https://guardarian.com/calculator/v2";
export const GUARD_CHECKOUT = "https://payments.guardarian.com/";

export interface GuardIntent {
  mode: "buy" | "sell";
  /** User's wallet — handed off as the payout address. */
  address: string;
  symbol?: string;
  amountUsd?: number;
  chainId?: number | null;
  /** Base URL for success/fail/cancel redirects (app origin). */
  origin?: string;
}

/**
 * Calculator v2 widget query — everything except `signature`, which the
 * API route appends last (it signs this exact serialized string).
 */
export function buildWidgetParams(intent: GuardIntent): URLSearchParams {
  const { ticker, network } = guardDestinationFor(intent.symbol, intent.chainId);
  const buy = intent.mode === "buy";
  const params = new URLSearchParams({
    partner_id: process.env.NEXT_PUBLIC_GUARDARIAN_PARTNER_ID ?? "",
    theme: "blue",
    type: "narrow",
    swap_enabled: "false",
    default_side: buy ? "buy_crypto" : "sell_crypto",
    side_toggle_disabled: "true",
    default_fiat_currency: "USD",
    // The buy stays inside our modal; checkout navigates the same frame.
    create_nav_behaviour: "same_tab",
    // VERIFY with the partner manager: their API body field is
    // payout_address — the widget param name isn't documented. Sent so a
    // supported reader prefills it; ignored harmlessly otherwise (the
    // checkout payout step is left enabled, never skipped).
    payout_address: intent.address,
    skip_choose_payout_address: "false",
  });
  if (buy) {
    params.set("default_crypto_currency", ticker);
    params.set("default_crypto_network", network);
    if (intent.amountUsd) {
      params.set("default_from_amount", String(Math.max(1, Math.ceil(intent.amountUsd))));
    }
  } else {
    params.set("default_swap_from_currency", ticker);
    params.set("default_swap_from_network", network);
  }
  if (intent.origin) {
    params.set("redirects_successful", intent.origin);
    params.set("redirects_failed", intent.origin);
    params.set("redirects_cancelled", intent.origin);
  }
  return params;
}

/**
 * Transaction link — lands the user directly in Guardarian checkout with
 * the pair and amount preset (no calculator step). api_key arrives from
 * the caller (server env); never hardcode it client-side.
 */
export function buildCheckoutParams(
  intent: GuardIntent,
  apiToken: string,
): URLSearchParams {
  const { ticker, network } = guardDestinationFor(intent.symbol, intent.chainId);
  const params = new URLSearchParams({ api_key: apiToken });
  if (intent.mode === "buy") {
    params.set("from_currency", "USD");
    if (intent.amountUsd) {
      params.set("from_amount", String(Math.max(1, Math.ceil(intent.amountUsd))));
    }
    params.set("to_currency", ticker);
    params.set("to_network", network);
  } else {
    params.set("from_currency", ticker);
    params.set("from_network", network);
    params.set("to_currency", "USD");
  }
  params.set("payout_address", intent.address); // same caveat as above
  if (intent.origin) {
    params.set("redirects_successful", intent.origin);
    params.set("redirects_failed", intent.origin);
    params.set("redirects_cancelled", intent.origin);
  }
  return params;
}

/** True when any credential path exists — the route still 501s without one. */
export function guardarianConfigured(): boolean {
  return Boolean(
    process.env.GUARDARIAN_PARTNER_API_TOKEN ||
      (process.env.GUARDARIAN_PRIVATE_KEY &&
        process.env.NEXT_PUBLIC_GUARDARIAN_PARTNER_ID),
  );
}
