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
import { isTestnetChain, NETWORKS } from '../../../config';

const MIN_SWAP_USD = 1.00; // Any $1+ swap unlocks G$ claim
const GRACE_PERIODS_PER_WEEK = 1;

// Validate Ethereum address
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Calculate streak state based on last activity
interface StreakDocument {
  lastActivity: number;
  daysActive: number;
  toObject: () => Record<string, unknown>;
}

function calculateStreakState(streak: StreakDocument) {
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

      case 'PATCH':
        return await handlePatch(normalizedAddress, req, res);

      case 'DELETE':
        return await handleDelete(normalizedAddress, res);

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('[Streak API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET - Retrieve streak data with cross-chain activity
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
        crossChainActivity: {
          testnet: { totalSwaps: 0, totalClaims: 0, totalVolume: 0, chainsUsed: [] },
          mainnet: { totalSwaps: 0, totalClaims: 0, totalVolume: 0 },
          graduation: { isGraduated: false, testnetActionsBeforeGraduation: 0 },
        },
        achievements: [],
        exists: false,
      });
    }

    const state = calculateStreakState(streak);
    return res.status(200).json({ 
      ...state, 
      crossChainActivity: streak.crossChainActivity,
      achievements: streak.achievements,
      exists: true 
    });
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

// PATCH - Update cross-chain activity
async function handlePatch(address: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const { action, chainId, networkType, usdValue, txHash, metadata } = req.body;

    // Validate required fields
    if (!action || !chainId || !networkType) {
      return res.status(400).json({ error: 'Missing required fields: action, chainId, networkType' });
    }

    const isTestnet = isTestnetChain(chainId);

    // Find or create streak record
    let streak = await Streak.findOne({ walletAddress: address });
    if (!streak) {
      streak = new Streak({
        walletAddress: address,
        startTime: Date.now(),
        lastActivity: Date.now(),
        daysActive: 0,
        gracePeriodsUsed: 0,
        totalSaved: 0,
        longestStreak: 0,
        totalStreaksCompleted: 0,
        milestones: { days7: false, days30: false, days100: false, days365: false },
        crossChainActivity: {
          testnet: { totalSwaps: 0, totalClaims: 0, totalVolume: 0, chainsUsed: [] },
          mainnet: { totalSwaps: 0, totalClaims: 0, totalVolume: 0 },
          graduation: { isGraduated: false, testnetActionsBeforeGraduation: 0 },
        },
        achievements: [],
        isPublic: false,
      });
    }

    // Update activity based on action and network type

    if (action === 'swap') {
      streak.crossChainActivity[isTestnet ? 'testnet' : 'mainnet'].totalSwaps += 1;
      if (usdValue) {
        streak.crossChainActivity[isTestnet ? 'testnet' : 'mainnet'].totalVolume += usdValue;
      }
    } else if (action === 'claim') {
      streak.crossChainActivity[isTestnet ? 'testnet' : 'mainnet'].totalClaims += 1;
    } else if (action === 'graduation') {
      streak.crossChainActivity.graduation.isGraduated = true;
      streak.crossChainActivity.graduation.graduatedAt = new Date();
      streak.crossChainActivity.graduation.testnetActionsBeforeGraduation = 
        streak.crossChainActivity.testnet.totalSwaps + streak.crossChainActivity.testnet.totalClaims;
    }

    // Track unique chains used (for testnet)
    if (isTestnet && !streak.crossChainActivity.testnet.chainsUsed.includes(chainId)) {
      streak.crossChainActivity.testnet.chainsUsed.push(chainId);
    }

    // Calculate and update achievements
    const newAchievements: string[] = [];
    const hasAchievement = (id: string) => streak.achievements.includes(id);

    // First Swap achievement
    const totalSwaps = streak.crossChainActivity.testnet.totalSwaps + streak.crossChainActivity.mainnet.totalSwaps;
    if (totalSwaps >= 1 && !hasAchievement('first-swap')) {
      streak.achievements.push('first-swap');
      newAchievements.push('first-swap');
    }

    // Multi-Chain Explorer (2+ testnet chains)
    if (streak.crossChainActivity.testnet.chainsUsed.length >= 2 && !hasAchievement('multi-chain-explorer')) {
      streak.achievements.push('multi-chain-explorer');
      newAchievements.push('multi-chain-explorer');
    }

    // Speed Demon (Arc testnet)
    if (streak.crossChainActivity.testnet.chainsUsed.includes(NETWORKS.ARC_TESTNET.chainId) && !hasAchievement('speed-demon')) {
      streak.achievements.push('speed-demon');
      newAchievements.push('speed-demon');
    }

    // Stock Trader (Robinhood)
    if (streak.crossChainActivity.testnet.chainsUsed.includes(NETWORKS.RH_TESTNET.chainId) && !hasAchievement('stock-trader')) {
      streak.achievements.push('stock-trader');
      newAchievements.push('stock-trader');
    }

    // Mento Master (Alfajores)
    if (streak.crossChainActivity.testnet.chainsUsed.includes(NETWORKS.ALFAJORES.chainId) && !hasAchievement('mento-master')) {
      streak.achievements.push('mento-master');
      newAchievements.push('mento-master');
    }

    // Power Tester (5+ testnet actions)
    const testnetActions = streak.crossChainActivity.testnet.totalSwaps + streak.crossChainActivity.testnet.totalClaims;
    if (testnetActions >= 5 && !hasAchievement('power-tester')) {
      streak.achievements.push('power-tester');
      newAchievements.push('power-tester');
    }

    // Volume Trader ($100+ testnet volume)
    if (streak.crossChainActivity.testnet.totalVolume >= 100 && !hasAchievement('volume-trader')) {
      streak.achievements.push('volume-trader');
      newAchievements.push('volume-trader');
    }

    // Daily Claimer (3+ claims)
    const totalClaims = streak.crossChainActivity.testnet.totalClaims + streak.crossChainActivity.mainnet.totalClaims;
    if (totalClaims >= 3 && !hasAchievement('daily-claimer')) {
      streak.achievements.push('daily-claimer');
      newAchievements.push('daily-claimer');
    }

    // Ready to Graduate (3+ testnet swaps, not yet graduated)
    if (streak.crossChainActivity.testnet.totalSwaps >= 3 &&
        !streak.crossChainActivity.graduation.isGraduated &&
        !hasAchievement('ready-to-graduate')) {
      streak.achievements.push('ready-to-graduate');
      newAchievements.push('ready-to-graduate');
    }

    // Mainnet Pioneer (graduated)
    if (streak.crossChainActivity.graduation.isGraduated && !hasAchievement('mainnet-pioneer')) {
      streak.achievements.push('mainnet-pioneer');
      newAchievements.push('mainnet-pioneer');
    }

    await streak.save();

    const state = calculateStreakState(streak);
    return res.status(200).json({
      success: true,
      ...state,
      crossChainActivity: streak.crossChainActivity,
      achievements: streak.achievements,
      newAchievements,
      message: `Activity recorded: ${action} on ${networkType}`,
    });
  } catch (error) {
    console.error('[Streak API] PATCH error:', error);
    return res.status(500).json({ error: 'Failed to update activity' });
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
