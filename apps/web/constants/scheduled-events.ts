/**
 * Scheduled events — hand-sourced, dated FACTS about what is coming up.
 * A date and a source, never a predicted outcome or direction. Re-verify
 * each entry by `asOf` + 90 days (dates can move — Nigeria's already did).
 */
export interface ScheduledEvent {
  id: string;
  /** ISO 4217 fiat the event is about (joined to tokens via the corridor side). */
  fiat: string;
  /** ISO date (first day for multi-day meetings). */
  date: string;
  /** Optional end date for multi-day events. */
  endDate?: string;
  /** Short noun phrase, no verdict. */
  event: string;
  glyph: string;
  source: string;
  url: string;
  asOf: string;
}

export const SCHEDULED_EVENTS: ScheduledEvent[] = [
  { id: 'ng-2027-presidential', fiat: 'NGN', date: '2027-01-16', event: 'Nigeria presidential & National Assembly elections', glyph: '🗳', source: 'INEC revised timetable', url: 'https://www.vanguardngr.com/2026/02/breaking-inec-moves-2027-presidential-poll-to-january-shifts-osun-guber/', asOf: '2026-09-29' },
  { id: 'ke-2027-general', fiat: 'KES', date: '2027-08-10', event: 'Kenya general election', glyph: '🗳', source: 'IEBC Gazette Notice 13497', url: 'https://www.kenyanews.go.ke/iebc-targets-28-5-million-voters-in-next-polls/', asOf: '2026-09-29' },
  { id: 'br-2026-first-round', fiat: 'BRL', date: '2026-10-04', event: 'Brazil general election, first round', glyph: '🗳', source: 'TSE', url: 'https://www.tse.jus.br/eleicoes/eleicoes-2026', asOf: '2026-09-29' },
  { id: 'br-2026-runoff', fiat: 'BRL', date: '2026-10-25', event: 'Brazil runoff, if needed', glyph: '🗳', source: 'TSE', url: 'https://www.tse.jus.br/eleicoes/eleicoes-2026', asOf: '2026-09-29' },
  { id: 'us-2026-midterms', fiat: 'USD', date: '2026-11-03', event: 'US midterm elections', glyph: '🗳', source: '2 U.S.C. §7', url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title2-section7&num=0&edition=prelim', asOf: '2026-09-29' },
  { id: 'us-fomc-2026-10', fiat: 'USD', date: '2026-10-27', endDate: '2026-10-28', event: 'Fed rate decision (FOMC)', glyph: '🏛', source: 'Federal Reserve FOMC calendar', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', asOf: '2026-09-29' },
  { id: 'us-fomc-2026-12', fiat: 'USD', date: '2026-12-08', endDate: '2026-12-09', event: 'Fed rate decision + projections (FOMC)', glyph: '🏛', source: 'Federal Reserve FOMC calendar', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', asOf: '2026-09-29' },
];
