/**
 * FunnelEvent Model — first-party cold-start funnel analytics.
 *
 * Privacy-lean by design: no IP, no wallet address, no user agent — just an
 * anonymous per-browser session id, an allowlisted event name, and coarse
 * context (country/philosophy). Events auto-expire after 90 days via TTL
 * index so the collection can't become a shadow profile store.
 *
 * Follows the existing model pattern (mongoose.models.X || mongoose.model).
 */

import mongoose, { Schema, Document } from 'mongoose';

export const FUNNEL_EVENTS = [
  'onboarding_viewed',
  'risk_moment_viewed',
  'philosophy_chosen',
  'wallet_prompt_viewed',
  'demo_opened',
  // Chat analytics — coarse, privacy-lean (no message content, just outcome)
  'chat_send',
  'chat_error',
  'chat_done',
  // Waitlist — self-selecting interest in the future business FX feature
  'business_hint_expanded',
  'waitlist_joined',
  'cycle_report_run',
  'cycle_monitoring_enabled',
  // BestYieldCard chain-pill filter — coarse utility signal.
  'yield_chain_filter_toggled',
  // Phase 4 graduation funnel — retail→business prompt lifecycle.
  // Coarse: server emits `graduation_signal_detected` with composite
  // confidence; client emits view/dismiss/click for engagement funnel.
  'graduation_signal_detected',
  'graduation_prompt_viewed',
  'graduation_prompt_dismissed',
  'graduation_prompt_clicked',
] as const;
export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

export interface IFunnelEvent extends Document {
  sessionId: string;
  event: FunnelEventName;
  /** Coarse context only — e.g. { country: 'KE', philosophy: 'africapitalism' } */
  props: Record<string, string>;
  createdAt: Date;
}

const FunnelEventSchema = new Schema<IFunnelEvent>({
  sessionId: { type: String, required: true, maxlength: 64 },
  event: { type: String, required: true, enum: FUNNEL_EVENTS },
  props: { type: Map, of: String, default: {} },
  createdAt: { type: Date, default: Date.now },
});

FunnelEventSchema.index({ event: 1, createdAt: -1 });
// TTL: funnel data is for product decisions, not retention profiling.
FunnelEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const FunnelEvent =
  mongoose.models.FunnelEvent ||
  mongoose.model<IFunnelEvent>('FunnelEvent', FunnelEventSchema);
