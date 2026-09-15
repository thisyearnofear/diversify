/**
 * The canvas-lite runtime calls window.matchMedia internally — where it
 * doesn't exist (jsdom, older webviews) the canvas must never mount, so
 * callers render the static primitive instead. Same contract as
 * reduced-motion: no WASM fetch, no canvas.
 */
export function canMountRive(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}
