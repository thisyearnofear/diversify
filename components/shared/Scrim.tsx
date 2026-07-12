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
