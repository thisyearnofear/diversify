import React from 'react';

interface ScrimProps {
  onClick?: () => void;
  className?: string;
  /**
   * Opacity tier. `default` matches the historic scrim (rgba 0,0,0,0.5);
   * `heavy` and `light` use the tokens defined in `styles/tokens.css` so
   * every modal/drawer surface can opt into a stronger or softer backdrop
   * without forking the styles.
   */
  intensity?: 'default' | 'heavy' | 'light';
}

/**
 * Scrim - Consistent backdrop overlay for modals and drawers.
 * Standardizes the blur and opacity across all overlay surfaces.
 *
 * IMPORTANT: render Scrim as a SIBLING of the overlay wrapper, never
 * nested inside it. It is `fixed inset-0 z-[49]` — inside a fixed z-50+
 * wrapper it creates a stacking context where z-49 paints above the
 * panel's z-auto, dimming the dialog and swallowing its clicks:
 *
 *   <Scrim onClick={onClose} />          {/* backdrop at z-49 *\/}
 *   <div className="fixed inset-0 z-50" onClick={onClose}>
 *     <Panel onClick={(e) => e.stopPropagation()} />
 *   </div>
 */
export function Scrim({ onClick, className = '', intensity = 'default' }: ScrimProps) {
  // Map the intensity prop to the matching token-driven utility class so
  // the backdrop picks up the right opacity / blur from `styles/tokens.css`.
  const intensityClass =
    intensity === 'heavy'
      ? 'scrim-heavy'
      : intensity === 'light'
        ? 'scrim-light'
        : 'scrim';
  return (
    <div
      onClick={onClick}
      className={`fixed inset-0 z-[49] ${intensityClass} ${className}`}
      aria-hidden="true"
    />
  );
}

export default Scrim;
