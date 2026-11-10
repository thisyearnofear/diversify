/**
 * useReservedHeight — hold a slot at the height of the tallest band it has
 * held, so switching bands never moves the page.
 *
 * The presenter grammar (§5: modes transform, never append) only reads as a
 * transform if the object's footprint survives it. A band that swaps in
 * shorter pulls the whole tab up under the user's thumb; one that swaps in
 * taller pushes the footer away. Either way the page jumps, and a jumping
 * page is an append wearing a disguise.
 *
 * So the floor is the max, not the resting height: flooring at what the rest
 * looks like only stops a band shrinking, and the band that needs more room
 * than the stage holds still moves everything. The cost is that the resting
 * view carries the air of its densest band — that is the trade the stage
 * makes on purpose. A band that needs more than the stage can hold is an
 * inspector, not a band.
 *
 * The height is measured, never guessed, and it only ever grows toward a
 * height this slot has actually rendered, so a transient state can't push it
 * past the tallest real band.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

export function useReservedHeight(): {
  ref: RefObject<HTMLDivElement>;
  style: CSSProperties | undefined;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.offsetHeight;
    if (height > floor) setFloor(height);
  });

  return {
    ref,
    style: floor > 0 ? { minHeight: floor } : undefined,
  };
}
