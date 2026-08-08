/**
 * User-facing Guardian copy — single agent identity.
 *
 * Internal services may still use "advisor"; UI must not expose that split.
 */

export const GUARDIAN_PRODUCT_NAME = 'Guardian';

export const ASK_GUARDIAN_LABEL = 'Ask Guardian';

export const GUARDIAN_TAB_LABEL = 'Guardian';

export const GUARDIAN_CONTROL_TITLE = 'Guardian Control';

export const GUARDIAN_DRAWER_SUBTITLE = 'Your protection companion';

export const AUTO_SAVER_CAPABILITY = 'Auto-Saver';

export const PROTECTION_PLAN_LABEL = 'Protection plan';

export const GUARDIAN_TIMELINE_LABEL = 'Guardian timeline';

export const GUARDIAN_UPDATES_LABEL = 'Guardian updates';

/** Drawer is for explanation — not the primary agent surface. */
export const GUARDIAN_DRAWER_PROMPTS = [
  'Why is my currency exposed?',
  'Explain this recommendation',
  'Review my protection plan',
  'What would happen if I enabled Guardian?',
  'Show me the evidence',
] as const;
