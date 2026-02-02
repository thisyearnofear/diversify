import { useMemo } from "react";


interface RegionData {
  region: string;
  value: number;
  color: string;
}

interface WealthProtectionParams {
  regionData: RegionData[];
  balances: any;
  userRegion: string;
  inflationData?: any;
}

export function useDiversification({ regionData, balances, userRegion, inflationData }: WealthProtectionParams) {
  // Calculate Wealth Protection Score (0-100)
  const diversificationScore = useMemo(() => {
    if (regionData.length === 0) return 0;

    // Calculate total value
    const totalValue = regionData.reduce((sum, r) => sum + r.value, 0);

    // Count regions with significant allocation (>5% of total)
    const significantRegions = regionData.filter((r) => (r.value / totalValue) * 100 >= 5).length;

    // Calculate distribution evenness
    const idealPerRegion = totalValue / 5; // 5 regions total

    let distributionScore = 0;
    if (totalValue > 0) {
      const deviations = regionData.map((r) =>
        Math.abs(r.value - idealPerRegion)
      );
      const totalDeviation = deviations.reduce((sum, d) => sum + d, 0);
      const maxPossibleDeviation = totalValue * 0.8; // Theoretical max deviation

      distributionScore = 100 - (totalDeviation / maxPossibleDeviation) * 100;
    }

    // Combine metrics (weighted)
    const regionsScore = (significantRegions / 5) * 100;
    const baseScore = Math.round(regionsScore * 0.6 + distributionScore * 0.4);

    // --- WEALTH PROTECTION ENHANCEMENTS ---
    let protectionBonus = 0;

    //1. RWA Bonus (Gold/Treasuries)
    const hasGold = balances?.PAXG || balances?.paxg;
    const hasTreasuries = false;

    if (hasGold) protectionBonus += 15;
    if (hasTreasuries) protectionBonus += 10;

    //2. Inflation Hedge Bonus
    const userRegionInflation = inflationData?.[userRegion]?.avgRate || 3.0;
    const isHedging = (hasGold || hasTreasuries) && userRegionInflation > 5;
    if (isHedging) protectionBonus += 10;

    // 3. Efficiency / Global Bonus
    if (balances?.USDC || balances?.usdc) protectionBonus += 5;

    return Math.min(100, baseScore + protectionBonus);
  }, [regionData, balances, userRegion, inflationData]);

  // Get rating based on score
  const diversificationRating = useMemo(() => {
    if (diversificationScore >= 80) return "Excellent";
    if (diversificationScore >= 60) return "Good";
    if (diversificationScore >= 40) return "Fair";
    if (diversificationScore >= 20) return "Poor";
    return "Very Poor";
  }, [diversificationScore]);

  // Get description based on score
  const diversificationDescription = useMemo(() => {
    if (diversificationScore >= 80)
      return "Your portfolio is globally diversified and includes RWA hedges against inflation.";
    if (diversificationScore >= 60)
      return "good regional balance. Adding more Arbitrum RWAs could further insulate you from local currency volatility.";
    if (diversificationScore >= 40)
      return "fair diversification, but high exposure to local inflation risks detected.";
    if (diversificationScore >= 20) return "poorly protected. Your savings are highly vulnerable to regional economic downturns.";
    return "highly concentrated. Your wealth is extremely exposed to single-region risk.";
  }, [diversificationScore]);

  // Get improvement tips based on score and region
  const diversificationTips = useMemo(() => {
    const regionCounts = regionData.reduce((acc, r) => {
      acc[r.region] = r.value;
      return acc;
    }, {} as Record<string, number>);

    const tips: string[] = [];

    // General tips based on score
    if (diversificationScore < 60) {
      tips.push("Aim to have at least 3 different regions in your portfolio.");
    }

    // Calculate total value for percentage calculations
    const totalValue = Object.values(regionCounts).reduce((sum, value) => sum + value, 0);

    // Region-specific tips - regions with less than 5% allocation
    const missingRegions = ["USA", "Europe", "LatAm", "Africa", "Asia"].filter(
      (r) => !regionCounts[r] || (totalValue > 0 && (regionCounts[r] / totalValue) * 100 < 5)
    );
    if (missingRegions.length > 0) {
      tips.push(
        `Consider adding exposure to ${missingRegions.join(
          ", "
        )
        } to improve diversification.`
      );
    }

    // Check for over-concentration (>40% in one region)
    const highConcentrationRegions = Object.entries(regionCounts)
      .filter(([_, value]) => totalValue > 0 && (value / totalValue) * 100 > 40)
      .map(([region]) => region);

    if (highConcentrationRegions.length > 0) {
      tips.push(
        `Reduce concentration in ${highConcentrationRegions.join(
          ", "
        )
        } by swapping to other regions.`
      );
    }

    // User region specific advice (>50% in home region)
    if (userRegion && regionCounts[userRegion] && totalValue > 0 &&
      (regionCounts[userRegion] / totalValue) * 100 > 50) {
      const inflation = inflationData?.[userRegion]?.avgRate || 0;
      if (inflation > 5) {
        tips.push(
          `Alert: High inflation(${inflation} %) in ${userRegion} is eroding your savings.Move to Arbitrum Gold or Treasuries.`
        );
      } else {
        tips.push(
          `You have high exposure to your home region(${userRegion}).Consider diversifying internationally.`
        );
      }
    }

    // RWA Specific Tips
    if (!balances?.PAXG && !balances?.paxg) {
      tips.push("Add Paxos Gold (PAXG) on Arbitrum as a hedge against currency debasement.");
    }

    // If no specific tips, give general advice
    if (tips.length === 0) {
      if (diversificationScore >= 80) {
        tips.push(
          "Your portfolio is well-diversified. Maintain this balance as your portfolio grows."
        );
      } else {
        tips.push(
          "Aim for a more even distribution across regions to improve diversification."
        );
      }
    }

    return tips;
  }, [regionData, diversificationScore, userRegion]);

  const goalScores = useMemo(() => {
    // 1. Hedge Inflation Score
    const hasGold = !!(balances?.PAXG || balances?.paxg);
    const hasStablecoins = !!(balances?.cUSD || balances?.cusd || balances?.USDC || balances?.usdc);
    const userRegionInflation = inflationData?.[userRegion]?.avgRate || 3.0;
    
    let hedgeScore = 40; // Base score for having any assets
    if (hasStablecoins) hedgeScore += 20;
    if (hasGold) hedgeScore += 30;
    if (userRegionInflation > 5 && hasGold) hedgeScore += 10;
    
    // 2. Diversify Regions Score
    const totalValue = regionData.reduce((sum, r) => sum + r.value, 0);
    const significantRegions = regionData.filter((r) => totalValue > 0 && (r.value / totalValue) * 100 >= 5).length;
    let diversifyScore = (significantRegions / 5) * 100;
    
    // 3. Access RWA Score
    let rwaScore = 0;
    if (hasGold) rwaScore += 70;
    // Add other RWA checks here if available
    
    return {
      hedge: Math.min(100, hedgeScore),
      diversify: Math.min(100, diversifyScore),
      rwa: Math.min(100, rwaScore)
    };
  }, [balances, regionData, userRegion, inflationData]);

  return {
    diversificationScore,
    diversificationRating,
    diversificationDescription,
    diversificationTips,
    goalScores,
  };
}
