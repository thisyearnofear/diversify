/**
 * The canvas-lite runtime calls window.matchMedia internally — where it
 * doesn't exist (jsdom, older webviews) the canvas must never mount, so
 * callers render the static primitive instead. Same contract as
 * reduced-motion: no WASM fetch, no canvas.
 *
 * Second constraint, learned the hard way: the WASM renderer draws
 * nothing for instances beyond ~7 live at once — the canvas mounts,
 * onRiveReady fires, the state machine plays, and zero pixels render.
 * Production surfaces mount 1–3 objects so it never bites there; it
 * bit `/rive-test`, which is why the dev boards page instead of stack.
 */
export function canMountRive(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}
