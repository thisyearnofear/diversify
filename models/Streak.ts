/**
 * Streak Model - MongoDB Schema for User Streak Data
 * 
 * Stores streak information for wallet addresses.
 * Designed for persistence across devices and browsers.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IStreak extends Document {
  walletAddress: string;
  startTime: number;
  lastActivity: number;
  daysActive: number;
  gracePeriodsUsed: number;
  totalSaved: number;

  // Historical tracking
  longestStreak: number;
  totalStreaksCompleted: number;

  // Milestones
  milestones: {
    days7: boolean;
    days30: boolean;
    days100: boolean;
    days365: boolean;
  };

  // Leaderboard (opt-in)
  displayName?: string;
  isPublic: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const StreakSchema: Schema = new Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    startTime: {
      type: Number,
      required: true,
      default: Date.now,
    },
    lastActivity: {
      type: Number,
      required: true,
      default: Date.now,
    },
    daysActive: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    gracePeriodsUsed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalSaved: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    // Historical tracking
    longestStreak: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalStreaksCompleted: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    // Milestones
    milestones: {
      days7: { type: Boolean, default: false },
      days30: { type: Boolean, default: false },
      days100: { type: Boolean, default: false },
      days365: { type: Boolean, default: false },
    },

    // Leaderboard opt-in
    displayName: {
      type: String,
      required: false,
      maxlength: 20,
    },
    isPublic: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Compound index for efficient queries
StreakSchema.index({ walletAddress: 1, updatedAt: -1 });

// Prevent model overwrite in hot reload
const Streak = mongoose.models.Streak || mongoose.model<IStreak>('Streak', StreakSchema);

export default Streak;
