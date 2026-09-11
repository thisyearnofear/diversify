/**
 * useSinceLastVisit — reads the previous session's snapshot for a surface
 * and keeps the current value written back for the next one.
 *
 * The read happens in an effect (never during render) so server and first
 * client renders match — the quiet "since you were here" line fades in
 * after mount instead of causing a hydration mismatch. The write follows
 * in a second effect, so the returned `previous` always holds LAST
 * session's value even as this session's value is stored over it.
 */

import { useEffect, useState } from "react";
import {
  readSnapshot,
  writeSnapshot,
  type VisitSnapshot,
} from "@/lib/since-last-visit";

export function useSinceLastVisit<T>(
  key: string,
  current: T | null | undefined,
): VisitSnapshot<T> | null {
  const [previous, setPrevious] = useState<VisitSnapshot<T> | null>(null);

  useEffect(() => {
    setPrevious(readSnapshot<T>(key));
  }, [key]);

  useEffect(() => {
    if (current == null) return;
    writeSnapshot(key, current);
  }, [key, current]);

  return previous;
}

export default useSinceLastVisit;
