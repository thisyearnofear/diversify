import { describe, it, expect } from 'vitest';
import { SCHEDULED_EVENTS } from '../scheduled-events';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

describe('SCHEDULED_EVENTS integrity', () => {
  it('has unique ids', () => {
    const seen = new Set<string>();
    for (const e of SCHEDULED_EVENTS) {
      expect(seen.has(e.id), `duplicate id ${e.id}`).toBe(false);
      seen.add(e.id);
    }
  });

  it('every entry carries all required fields', () => {
    for (const e of SCHEDULED_EVENTS) {
      expect(e.fiat, `${e.id} fiat`).toMatch(/^[A-Z]{3}$/);
      expect(e.event.trim().length, `${e.id} event`).toBeGreaterThan(0);
      expect(e.glyph.trim().length, `${e.id} glyph`).toBeGreaterThan(0);
      expect(e.source.trim().length, `${e.id} source`).toBeGreaterThan(0);
      expect(e.url, `${e.id} url`).toMatch(/^https:\/\//);
      expect(e.date, `${e.id} date`).toMatch(ISO_DATE);
      expect(Number.isNaN(Date.parse(e.date)), `${e.id} date parses`).toBe(false);
      if (e.endDate !== undefined) {
        expect(e.endDate, `${e.id} endDate`).toMatch(ISO_DATE);
        expect(Date.parse(e.endDate), `${e.id} endDate >= date`).toBeGreaterThanOrEqual(
          Date.parse(e.date),
        );
      }
      expect(e.asOf, `${e.id} asOf`).toMatch(ISO_DATE);
    }
  });

  it('each entry is fresh: asOf within 90 days of the event date, or the date is still ahead', () => {
    const now = Date.now();
    for (const e of SCHEDULED_EVENTS) {
      const eventMs = Date.parse(e.endDate ?? e.date);
      if (eventMs >= now) continue; // still upcoming — freshness matters less than existence
      const age = eventMs - Date.parse(e.asOf);
      expect(
        Math.abs(age) <= NINETY_DAYS_MS,
        `${e.id}: asOf ${e.asOf} is >90 days from date ${e.date} and the event has passed`,
      ).toBe(true);
    }
  });

  it('names a date and a source, never a predicted outcome', () => {
    for (const e of SCHEDULED_EVENTS) {
      expect(e.event, `${e.id} must not predict a direction`).not.toMatch(
        /\b(will|expected to|forecast|likely to)\b/i,
      );
    }
  });
});
