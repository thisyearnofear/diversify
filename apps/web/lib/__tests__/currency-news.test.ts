import { describe, expect, it } from 'vitest';
import { currencyNewsQuery, toCurrencyNewsItems } from '../currency-news';
import type { TavilyResult } from '@diversifi/shared/src/services/tavily-search.service';

const r = (over: Partial<TavilyResult>): TavilyResult => ({
  title: 'Title',
  url: 'https://example.com/a',
  snippet: '',
  score: 0.5,
  source: 'example.com',
  ...over,
});

describe('currencyNewsQuery', () => {
  it('derives the query from the curated entry', () => {
    expect(currencyNewsQuery('ngn')).toMatch(/Nigeria naira/);
  });
  it('returns null for unknown or empty codes', () => {
    expect(currencyNewsQuery('ZZZ')).toBeNull();
    expect(currencyNewsQuery(null)).toBeNull();
  });
});

describe('toCurrencyNewsItems', () => {
  it('keeps https links only, dedupes, and sorts newest first with undated last', () => {
    const items = toCurrencyNewsItems(
      [
        r({ url: 'https://a.com/1', title: 'Old', publishedDate: 'Mon, 05 Oct 2026 10:00:00 GMT' }),
        r({ url: 'http://insecure.com/x', title: 'Insecure' }),
        r({ url: 'https://a.com/2', title: 'Undated' }),
        r({ url: 'https://a.com/3', title: 'New', publishedDate: 'Tue, 13 Oct 2026 10:00:00 GMT' }),
        r({ url: 'https://a.com/3', title: 'Dupe' }),
      ],
      5,
    );
    expect(items.map((i) => i.title)).toEqual(['New', 'Old', 'Undated']);
    expect(items[0].date).toBe('2026-10-13');
    expect(items[2].date).toBeNull();
  });
  it('treats an unparseable date as undated, never invents one', () => {
    expect(toCurrencyNewsItems([r({ publishedDate: 'recently' })])[0].date).toBeNull();
  });
  it('drops hype-laden headlines', () => {
    const items = toCurrencyNewsItems([
      r({ url: 'https://a.com/1', title: 'Naira to zero? Traders dump cedi' }),
      r({ url: 'https://a.com/2', title: 'Naira steadies after CBN move' }),
    ]);
    expect(items.map((i) => i.title)).toEqual(['Naira steadies after CBN move']);
  });
  it('with a code, keeps only rows about that country and its money', () => {
    const items = toCurrencyNewsItems(
      [
        r({ url: 'https://a.com/1', title: 'Iraq devalues its currency as war disrupts shipping' }),
        r({ url: 'https://a.com/2', title: 'Turning Nigeria’s gold endowment into an industrial asset', snippet: 'Mining policy.' }),
        r({ url: 'https://a.com/3', title: 'Nigerian central bank holds rates', snippet: '' }),
        r({ url: 'https://a.com/4', title: 'Markets update', snippet: 'The NGN moved against the dollar' }),
      ],
      5,
      'NGN',
    );
    expect(items.map((i) => i.url)).toEqual(['https://a.com/3', 'https://a.com/4']);
  });
  it('an unknown code keeps nothing', () => {
    expect(toCurrencyNewsItems([r({ title: 'Naira news' })], 3, 'ZZZ')).toEqual([]);
  });
  it('does not let an ambiguous currency name vouch for the wrong country', () => {
    const items = toCurrencyNewsItems(
      [r({ url: 'https://a.com/u', title: 'Uganda shilling hits lowest level in 33 years' })],
      3,
      'KES',
    );
    expect(items).toEqual([]);
  });
});
