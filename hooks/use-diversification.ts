import { useMemo } from "react";

interface RegionData {
  region: string;
  value: number;
  color: string;
}

export function useDiversification(regionData: RegionData[], userRegion: string) {
  // Calculate diversification score (0-100)
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
    return Math.round(regionsScore * 0.6 + distributionScore * 0.4);
  }, [regionData]);

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
      return "well-diversified across multiple regions, providing excellent protection against regional economic risks.";
    if (diversificationScore >= 60)
      return "reasonably diversified, but could benefit from some adjustments to improve balance.";
    if (diversificationScore >= 40)
      return "somewhat diversified, but has significant concentration in certain regions.";
    if (diversificationScore >= 20) return "poorly diversified with high concentration risk.";
    return "extremely concentrated and vulnerable to regional economic risks.";
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
        )} to improve diversification.`
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
        )} by swapping to other regions.`
      );
    }

    // User region specific advice (>50% in home region)
    if (userRegion && regionCounts[userRegion] && totalValue > 0 &&
        (regionCounts[userRegion] / totalValue) * 100 > 50) {
      tips.push(
        `You have high exposure to your home region (${userRegion}). Consider diversifying more internationally.`
      );
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

  return {
    diversificationScore,
    diversificationRating,
    diversificationDescription,
    diversificationTips,
  };
}
