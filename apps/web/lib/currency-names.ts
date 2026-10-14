/** Colloquial currency names → ISO code. Only names that map to exactly
 *  one currency in our coverage — 'peso', 'pound', 'rupee' and 'real'
 *  are ambiguous (or plain English) and stay out on purpose. */
export const CURRENCY_NAME_ALIASES: Record<string, string> = {
  naira: 'NGN', cedi: 'GHS', cedis: 'GHS',
  shilling: 'KES', rand: 'ZAR',
  lira: 'TRY', hryvnia: 'UAH', gourde: 'HTG',
  ruble: 'RUB', rouble: 'RUB',
  rupiah: 'IDR', baht: 'THB', dong: 'VND',
  euro: 'EUR', euros: 'EUR',
  dollar: 'USD', dollars: 'USD',
};

/** The colloquial name for a code ("NGN" → "naira"), when it has one.
 *  Plain-English dollar/euro are left out — they say nothing about a country. */
export function currencyNameFor(code: string): string | null {
  for (const [name, c] of Object.entries(CURRENCY_NAME_ALIASES)) {
    if (c === code.toUpperCase() && name !== 'dollar' && name !== 'euro' && !name.endsWith('s') && name !== 'rouble') {
      return name;
    }
  }
  return null;
}
