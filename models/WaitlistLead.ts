/**
 * WaitlistLead Model — early-access interest capture for future features.
 *
 * Unlike FunnelEvent (anonymous, TTL-expired analytics), a waitlist lead's
 * whole purpose is being retained for future outreach — no TTL index here,
 * intentionally. `consentAcknowledged` is the durable server-side record
 * that the inline disclosure copy was shown at capture time, since this
 * app has no privacy-policy page to point to instead.
 *
 * Follows the existing model pattern (mongoose.models.X || mongoose.model).
 */

import mongoose, { Schema, Document } from 'mongoose';

export const WAITLIST_FEATURES = ['sme_fx'] as const;
export type WaitlistFeature = (typeof WAITLIST_FEATURES)[number];

export interface IWaitlistLead extends Document {
  email: string;
  feature: WaitlistFeature;
  source: string;
  userRegion?: string;
  consentAcknowledged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WaitlistLeadSchema = new Schema<IWaitlistLead>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    feature: { type: String, required: true, enum: WAITLIST_FEATURES },
    source: { type: String, required: true, maxlength: 64 },
    userRegion: { type: String },
    consentAcknowledged: { type: Boolean, required: true },
  },
  { timestamps: true },
);

// Compound unique, not a global email-unique index: the same person may
// legitimately join a future *different* waitlist later, but only once
// per feature.
WaitlistLeadSchema.index({ email: 1, feature: 1 }, { unique: true });
WaitlistLeadSchema.index({ feature: 1, createdAt: -1 });

export const WaitlistLead =
  mongoose.models.WaitlistLead || mongoose.model<IWaitlistLead>('WaitlistLead', WaitlistLeadSchema);
