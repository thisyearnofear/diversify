/**
 * Streak Stats API
 * 
 * GET /api/streaks/stats - Get community-wide streak statistics
 * 
 * Returns:
 * - todayClaims: Number of users who saved today
 * - totalClaimed: Total G$ claimed (formatted)
 * - activeStreaks: Number of users with active streaks
 * - topStreak: Longest current streak
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../lib/mongodb';
import Streak from '../../../models/Streak';

interface StatsResponse {
    todayClaims: number;
    totalClaimed: string;
    activeStreaks: number;
    topStreak: number;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<StatsResponse | { error: string }>
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        await connectDB();

        const now = Date.now();
        const todayStart = Math.floor(now / 86400000) * 86400000; // Start of today in ms

        // Count users who saved today (lastActivity >= todayStart)
        const todayClaims = await Streak.countDocuments({
            lastActivity: { $gte: todayStart }
        });

        // Count users with active streaks (daysActive > 0)
        const activeStreaks = await Streak.countDocuments({
            daysActive: { $gt: 0 }
        });

        // Get total G$ claimed (sum of all totalSaved)
        const totalResult = await Streak.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalSaved' }
                }
            }
        ]);
        const totalSaved = totalResult[0]?.total || 0;

        // Get longest current streak
        const topStreakDoc = await Streak.findOne()
            .sort({ daysActive: -1 })
            .select('daysActive')
            .lean();
        const topStreak = topStreakDoc?.daysActive || 0;

        // Format total claimed
        const formatNumber = (num: number): string => {
            if (num >= 1000000) {
                return `${(num / 1000000).toFixed(1)}M`;
            } else if (num >= 1000) {
                return `${(num / 1000).toFixed(1)}K`;
            }
            return num.toFixed(0);
        };

        return res.status(200).json({
            todayClaims,
            totalClaimed: formatNumber(totalSaved),
            activeStreaks,
            topStreak,
        });
    } catch (error) {
        console.error('[Streak Stats API] Error:', error);
        return res.status(500).json({ error: 'Failed to fetch stats' });
    }
}
