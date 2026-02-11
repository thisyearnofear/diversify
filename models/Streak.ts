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
