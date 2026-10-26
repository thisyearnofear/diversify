/**
 * Selection ids for Shield's ring — a leaf module so non-component
 * consumers (the mode machine, the voice-verb grammar) can resolve the
 * same ids without importing the ring.
 */

/** Selection id the parent uses for the tokenized-asset (RWA) lens. */
export const SLEEVE_ID = 'sleeve';

/** Selection id for the Guardian suggestion preview wedge. */
export const TILT_ID = 'guardian-tilt';

/** Prefix for a concrete vault inside the sleeve ('vault:ixs-1' etc.). */
export const VAULT_SLICE_PREFIX = 'vault:';

export function isSleeveSelection(id: string | null | undefined): boolean {
  return id === SLEEVE_ID || Boolean(id?.startsWith(VAULT_SLICE_PREFIX));
}
