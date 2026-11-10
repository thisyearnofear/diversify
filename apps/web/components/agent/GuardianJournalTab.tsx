/**
 * GuardianJournalTab - the Guardian's decision calendar.
 *
 * The journal is a calendar, not a feed: proof events land as dots on
 * the days the Guardian moved. Tap a day, read its cards — each keeps
 * the 0G anchoring status chips (anchored / recorded-without-evidence /
 * pending / failed stay honest).
 */

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MIN_AUTO_SAVER_FUNDS_USD } from "@/constants/guardian-limits";
import { haptics } from "@/lib/haptics";

export type GuardianProofEvent = {
  id: string;
  source: "vault" | "wdk";
  title: string;
  subtitle: string;
  timestamp: number;
  status: string;
  explorerUrl?: string;
  txHash?: string;
  error?: string;
};

type AnchorInfo = {
  status: string;
  id?: number;
  explorerUrl?: string;
  error?: string;
  /**
   * True only when a real 0G Storage evidence CID backed this on-chain
   * write. A real tx can still have this false — render that combination
   * distinctly rather than as a fully verified anchor.
   */
  evidenceUploaded?: boolean;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Dot tone follows the settlement fact: green confirmed, red failed,
 *  amber anything still in flight. */
function eventTone(status: string): string {
  if (status === "confirmed") return "bg-emerald-500";
  if (status === "failed") return "bg-red-500";
  return "bg-amber-500";
}

function EventCard({
  event,
  anchor,
  isLatest,
}: {
  event: GuardianProofEvent;
  anchor: AnchorInfo | undefined;
  isLatest: boolean;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border ${
        isLatest
          ? "border-green-100 dark:border-green-900/50 ring-1 ring-green-50 dark:ring-green-900/20"
          : "border-gray-100 dark:border-gray-700"
      } relative overflow-hidden`}
    >
      <div className="absolute top-3 right-3 opacity-20 text-xl grayscale pointer-events-none">
        {event.source === "wdk" ? "🌌" : "🛡️"}
      </div>

      <div className="flex justify-between items-start mb-1 pr-8">
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {event.title}
        </span>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {new Date(event.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {anchor && anchor.status === "anchored" && anchor.evidenceUploaded !== false && (
        <a
          href={anchor.explorerUrl ?? event.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="anchor-chip"
          className="inline-flex items-center gap-1 mt-1 text-2xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-full"
          title={
            anchor.id && anchor.id > 0
              ? `0G RecommendationLedger #${anchor.id}`
              : "Anchored on 0G (awaiting event index)"
          }
        >
          <span className="w-1 h-1 rounded-full bg-emerald-500" />
          {anchor.id && anchor.id > 0 ? `0G #${anchor.id}` : "0G anchored"}
        </a>
      )}
      {anchor && anchor.status === "anchored" && anchor.evidenceUploaded === false && (
        <a
          href={anchor.explorerUrl ?? event.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="anchor-chip-no-evidence"
          className="inline-flex items-center gap-1 mt-1 text-2xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/60 px-1.5 py-0.5 rounded-full"
          title="On-chain record is real, but the 0G Storage evidence upload did not complete"
        >
          <span className="w-1 h-1 rounded-full bg-amber-500" />
          0G recorded (no evidence)
        </a>
      )}
      {anchor && anchor.status === "pending" && (
        <span
          data-testid="anchor-chip-pending"
          className="inline-flex items-center gap-1 mt-1 text-2xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/60 px-1.5 py-0.5 rounded-full"
        >
          <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
          0G pending
        </span>
      )}
      {anchor && anchor.status === "failed" && (
        <span
          className="inline-flex items-center gap-1 mt-1 text-2xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/60 px-1.5 py-0.5 rounded-full"
          title={anchor.error ?? "0G anchor failed"}
        >
          <span className="w-1 h-1 rounded-full bg-red-500" />
          0G failed
        </span>
      )}
      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
        {event.subtitle}
      </p>
      {event.error && <p className="mt-2 text-xs text-red-500">{event.error}</p>}
      {(event.explorerUrl || event.status) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {event.explorerUrl ? (
            <a
              href={event.explorerUrl}
              target="_blank"
              className="text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-800 transition-colors whitespace-nowrap"
            >
              View Evidence
            </a>
          ) : (
            <span className="text-xs font-bold text-gray-400">
              No explorer receipt
            </span>
          )}
          <span
            className={`text-2xs uppercase font-bold px-1.5 py-0.5 rounded italic flex items-center gap-1 ${
              event.status === "confirmed"
                ? "text-green-500 bg-green-50 dark:bg-green-900/20"
                : event.status === "failed"
                  ? "text-red-500 bg-red-50 dark:bg-red-900/20"
                  : "text-amber-500 bg-amber-50 dark:bg-amber-900/20"
            }`}
          >
            <span
              className={`w-1 h-1 rounded-full ${
                event.status === "confirmed"
                  ? "bg-green-500 animate-pulse"
                  : event.status === "failed"
                    ? "bg-red-500"
                    : "bg-amber-500"
              }`}
            />
            {event.status}
          </span>
        </div>
      )}
    </motion.div>
  );
}

export const GuardianJournalTab: React.FC<{
  events: GuardianProofEvent[];
  anchorByTxHash: Map<string, AnchorInfo>;
  hasValidPermission: boolean;
  isLowOnFunds: boolean;
  isRunningLoop: boolean;
  onNavigateToFund?: () => void;
  onPreview: () => void;
}> = ({
  events,
  anchorByTxHash,
  hasValidPermission,
  isLowOnFunds,
  isRunningLoop,
  onNavigateToFund,
  onPreview,
}) => {
  const sorted = useMemo(
    () => [...events].sort((a, b) => b.timestamp - a.timestamp),
    [events],
  );
  // Day → events, newest first inside the day.
  const byDay = useMemo(() => {
    const map = new Map<string, GuardianProofEvent[]>();
    for (const event of sorted) {
      const key = dayKey(event.timestamp);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [sorted]);

  const now = new Date();
  const [month, setMonth] = useState(() => {
    const d = sorted[0] ? new Date(sorted[0].timestamp) : now;
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(() =>
    sorted[0] ? dayKey(sorted[0].timestamp) : null,
  );

  const earliest = sorted.length
    ? new Date(sorted[sorted.length - 1].timestamp)
    : now;
  const atEarliest =
    month.year < earliest.getFullYear() ||
    (month.year === earliest.getFullYear() && month.month <= earliest.getMonth());
  const atCurrent =
    month.year > now.getFullYear() ||
    (month.year === now.getFullYear() && month.month >= now.getMonth());

  const shiftMonth = (delta: number) => {
    haptics.tap();
    setSelectedKey(null);
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString(
    [],
    { month: "long", year: "numeric" },
  );
  const monthName = monthLabel.split(" ")[0];
  const monthCount = sorted.filter((e) => {
    const d = new Date(e.timestamp);
    return d.getFullYear() === month.year && d.getMonth() === month.month;
  }).length;

  // Calendar cells: blanks before day 1, then every day of the month.
  const firstWeekday = new Date(month.year, month.month, 1).getDay();
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const todayKey = dayKey(now.getTime());
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedEvents = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
          Decision calendar
        </h4>
        {events.length > 0 && (
          <span className="text-2xs text-gray-400 italic">
            {events.length} marked
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 px-6 space-y-3">
          <span className="text-3xl block">
            {hasValidPermission && isLowOnFunds ? "💸" : "🛡️"}
          </span>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
            {!hasValidPermission
              ? "Nothing to show yet"
              : isLowOnFunds
                ? "Guardian is waiting for funds before its first proposal."
                : "Guardian is watching. No moves yet."}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
            {!hasValidPermission
              ? "Set a daily limit and every proposal, move and on-chain receipt appears here."
              : isLowOnFunds
                ? `Top up with at least $${MIN_AUTO_SAVER_FUNDS_USD} in stables. Guardian will propose at the next chance it sees.`
                : "Every proposal and move will appear here with a verifiable receipt."}
          </p>
          {hasValidPermission &&
            (isLowOnFunds && onNavigateToFund ? (
              <button
                type="button"
                onClick={onNavigateToFund}
                className="mt-2 text-2xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-200 bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 transition-colors"
              >
                Add funds
              </button>
            ) : !isLowOnFunds ? (
              <button
                type="button"
                onClick={onPreview}
                disabled={isRunningLoop}
                className="mt-2 text-2xs font-bold uppercase tracking-wider text-ink bg-surface hover:bg-surface-sunken border border-line rounded-xl px-4 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRunningLoop ? "Previewing…" : "Preview next move"}
              </button>
            ) : null)}
        </div>
      ) : (
        <>
          <div
            data-testid="journal-calendar"
            className="rounded-2xl border border-line bg-surface p-3"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                disabled={atEarliest}
                onClick={() => shiftMonth(-1)}
                className="min-h-tap px-2 text-sm font-bold text-ink-muted transition-colors hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ←
              </button>
              <p className="text-xs font-bold uppercase tracking-wide text-ink">
                {monthLabel}
              </p>
              <button
                type="button"
                aria-label="Next month"
                disabled={atCurrent}
                onClick={() => shiftMonth(1)}
                className="min-h-tap px-2 text-sm font-bold text-ink-muted transition-colors hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
            <div className="mt-1 grid grid-cols-7 text-center">
              {WEEKDAYS.map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  aria-hidden="true"
                  className="py-1 text-3xs font-bold uppercase text-ink-subtle"
                >
                  {w}
                </span>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <span key={`blank-${i}`} />;
                const key = `${month.year}-${String(month.month + 1).padStart(
                  2,
                  "0",
                )}-${String(day).padStart(2, "0")}`;
                const dayEvents = byDay.get(key);
                const isSelected = selectedKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    data-testid={`journal-day-${key}`}
                    aria-pressed={isSelected}
                    aria-label={
                      dayEvents
                        ? `${key} · ${dayEvents.length} decision${
                            dayEvents.length === 1 ? "" : "s"
                          }`
                        : key
                    }
                    disabled={!dayEvents}
                    onClick={() => {
                      haptics.tap();
                      setSelectedKey(isSelected ? null : key);
                    }}
                    className={`flex min-h-[2.25rem] flex-col items-center justify-start rounded-lg pt-1 text-2xs font-bold transition-colors ${
                      isSelected
                        ? "bg-ink text-white dark:bg-white dark:text-ink"
                        : dayEvents
                          ? "text-ink hover:bg-ink/[0.06]"
                          : "text-ink-subtle/60 cursor-default"
                    } ${key === todayKey && !isSelected ? "ring-1 ring-blue-400/60" : ""}`}
                  >
                    {day}
                    <span className="mt-0.5 flex h-1.5 items-center gap-[3px]">
                      {dayEvents?.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={`size-1.5 rounded-full ${
                            isSelected
                              ? "bg-white/80 dark:bg-ink/60"
                              : eventTone(e.status)
                          }`}
                        />
                      ))}
                      {dayEvents && dayEvents.length > 3 && (
                        <span
                          className={`text-[8px] leading-none ${
                            isSelected
                              ? "text-white/80 dark:text-ink/60"
                              : "text-ink-subtle"
                          }`}
                        >
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-center text-3xs uppercase tracking-wide text-ink-subtle">
              {monthCount > 0
                ? `${monthCount} in ${monthName} · tap a marked day`
                : "no marks this month"}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {selectedEvents.length > 0 && (
              <motion.div
                key={selectedKey}
                data-testid="journal-day-events"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar"
              >
                {selectedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    anchor={
                      event.txHash
                        ? anchorByTxHash.get(event.txHash.toLowerCase())
                        : undefined
                    }
                    isLatest={event.id === sorted[0]?.id}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};
