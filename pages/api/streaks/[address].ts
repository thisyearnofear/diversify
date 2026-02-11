/**
 * Streak API Routes
 * 
 * GET /api/streaks/[address] - Get streak data for a wallet
 * POST /api/streaks/[address] - Record a save/update streak
 * DELETE /api/streaks/[address] - Reset streak (dev only)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../lib/mongodb';
import Streak from '../../../models/Streak';

const MIN_SWAP_USD = 1.00; // Any $1+ swap unlocks G$ claim
const GRACE_PERIODS_PER_WEEK = 1;

// Validate Ethereum address
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Calculate streak state based on last activity
function calculateStreakState(streak: { lastActivity: number; daysActive: number; toObject: () => any }) {
  const today = Math.floor(Date.now() / 86400000);
  const lastActivityDay = Math.floor(streak.lastActivity / 86400000);
  const daysSinceActivity = today - lastActivityDay;

  const isStreakActive = daysSinceActivity <= 1;
  const canClaim = isStreakActive && streak.daysActive > 0;

  return {
    ...streak.toObject(),
    isStreakActive,
    canClaim,
    daysSinceActivity,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Invalid address' });
  }

  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address format' });
  }

  const normalizedAddress = address.toLowerCase();

  try {
    await connectDB();

    switch (req.method) {
      case 'GET':
        return await handleGet(normalizedAddress, res);

      case 'POST':
        return await handlePost(normalizedAddress, req, res);

      case 'DELETE':
        return await handleDelete(normalizedAddress, res);

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('[Streak API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET - Retrieve streak data
async function handleGet(address: string, res: NextApiResponse) {
  try {
    const streak = await Streak.findOne({ walletAddress: address });

    if (!streak) {
      // Return default state for new users
      return res.status(200).json({
        walletAddress: address,
        startTime: null,
        lastActivity: null,
        daysActive: 0,
        gracePeriodsUsed: 0,
        totalSaved: 0,
        isStreakActive: false,
        canClaim: false,
        exists: false,
      });
    }

    const state = calculateStreakState(streak);
    return res.status(200).json({ ...state, exists: true });
  } catch (error) {
    console.error('[Streak API] GET error:', error);
    return res.status(500).json({ error: 'Failed to fetch streak' });
  }
}

// POST - Record a save activity
async function handlePost(address: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const { amountUSD } = req.body;

    if (!amountUSD || amountUSD < MIN_SWAP_USD) {
      return res.status(400).json({
        error: `Minimum swap amount is $${MIN_SWAP_USD}`
      });
    }

    const today = Math.floor(Date.now() / 86400000);

    // Find or create streak
    let streak = await Streak.findOne({ walletAddress: address });

    if (!streak) {
      // Create new streak
      streak = new Streak({
        walletAddress: address,
        startTime: Date.now(),
        lastActivity: Date.now(),
        daysActive: 1,
        gracePeriodsUsed: 0,
        totalSaved: amountUSD,
        longestStreak: 1,
        totalStreaksCompleted: 0,
        milestones: {
          days7: false,
          days30: false,
          days100: false,
          days365: false,
        },
        isPublic: false,
      });
    } else {
      const lastDay = Math.floor(streak.lastActivity / 86400000);

      if (today === lastDay) {
        // Already saved today - just update amount
        streak.totalSaved += amountUSD;
        streak.lastActivity = Date.now();
      } else if (today === lastDay + 1) {
        // Consecutive day - streak continues
        streak.daysActive += 1;
        streak.lastActivity = Date.now();
        streak.totalSaved += amountUSD;
      } else if (today <= lastDay + 2 && streak.gracePeriodsUsed < GRACE_PERIODS_PER_WEEK) {
        // Used grace period
        streak.daysActive += 1;
        streak.gracePeriodsUsed += 1;
        streak.lastActivity = Date.now();
        streak.totalSaved += amountUSD;
      } else {
        // Streak broken - record it and start over
        if (streak.daysActive >= 7) {
          streak.totalStreaksCompleted += 1;
        }

        // Update longest streak if current was longer
        if (streak.daysActive > streak.longestStreak) {
          streak.longestStreak = streak.daysActive;
        }

        // Start fresh
        streak.startTime = Date.now();
        streak.lastActivity = Date.now();
        streak.daysActive = 1;
        streak.gracePeriodsUsed = 0;
        streak.totalSaved = amountUSD;
      }
    }

    // Check and award milestones
    const newMilestones: string[] = [];

    if (streak.daysActive >= 7 && !streak.milestones.days7) {
      streak.milestones.days7 = true;
      newMilestones.push('7-Day Streak! 🔥');
    }
    if (streak.daysActive >= 30 && !streak.milestones.days30) {
      streak.milestones.days30 = true;
      newMilestones.push('30-Day Streak! 🏆');
    }
    if (streak.daysActive >= 100 && !streak.milestones.days100) {
      streak.milestones.days100 = true;
      newMilestones.push('100-Day Streak! 💎');
    }
    if (streak.daysActive >= 365 && !streak.milestones.days365) {
      streak.milestones.days365 = true;
      newMilestones.push('365-Day Streak! 👑');
    }

    // Update longest streak if current is longer
    if (streak.daysActive > streak.longestStreak) {
      streak.longestStreak = streak.daysActive;
    }

    await streak.save();

    const state = calculateStreakState(streak);
    return res.status(200).json({
      success: true,
      ...state,
      newMilestones,
      message: `Streak updated! ${streak.daysActive} day${streak.daysActive !== 1 ? 's' : ''} active`
    });
  } catch (error) {
    console.error('[Streak API] POST error:', error);
    return res.status(500).json({ error: 'Failed to update streak' });
  }
}

// DELETE - Reset streak (for testing)
async function handleDelete(address: string, res: NextApiResponse) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }

  try {
    await Streak.deleteOne({ walletAddress: address });
    return res.status(200).json({ success: true, message: 'Streak reset' });
  } catch (error) {
    console.error('[Streak API] DELETE error:', error);
    return res.status(500).json({ error: 'Failed to reset streak' });
  }
}
