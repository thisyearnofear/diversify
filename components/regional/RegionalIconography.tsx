import React from "react";
import type { Region } from "../../hooks/use-user-region";
import { REGION_GRADIENTS, type AssetRegion } from "../../config";

interface RegionalIconographyProps {
  region: Region;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Component that displays culturally relevant iconography for each region
 * This helps users connect with their regional identity and makes the app more relatable
 */
export default function RegionalIconography({
  region,
  size = "md",
  className = "",
}: RegionalIconographyProps) {
  // Size classes
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };

  // Get region-specific icon and gradient
  const getRegionStyles = (region: Region) => {
    switch (region) {
      case "Africa":
        return {
          gradient: 'from-red-500 to-orange-500',
          icon: "🌍",
          alt: "African pattern",
        };
      case "USA":
        return {
          gradient: 'from-blue-500 to-cyan-500',
          icon: "🏙️",
          alt: "USA pattern",
        };
      case "Europe":
        return {
          gradient: 'from-green-500 to-emerald-500',
          icon: "🏰",
          alt: "European pattern",
        };
      case "LatAm":
        return {
          gradient: 'from-amber-500 to-yellow-500',
          icon: "🌴",
          alt: "Latin American pattern",
        };
      case "Asia":
        return {
          gradient: 'from-purple-500 to-pink-500',
          icon: "🏮",
          alt: "Asian pattern",
        };
      default:
        return {
          gradient: 'from-indigo-500 to-violet-500',
          icon: "🌎",
          alt: "Global pattern",
        };
    }
  };

  const regionStyles = getRegionStyles(region);

  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 border-white/50 bg-gradient-to-br ${regionStyles.gradient} shadow-lg ${sizeClasses[size]} ${className}`}
      title={`${region} region`}
    >
      <span className="text-2xl drop-shadow-sm" role="img" aria-label={regionStyles.alt}>
        {regionStyles.icon}
      </span>
    </div>
  );
}

// Component for displaying a regional pattern background
export function RegionalPattern({
  region,
  className = "",
}: {
  region: Region;
  className?: string;
}) {
  // Get region-specific pattern
  const getRegionPattern = (region: Region) => {
    switch (region) {
      case "Africa":
        return "bg-[radial-gradient(#FEE2E2_1px,transparent_1px)] bg-[size:20px_20px]";
      case "USA":
        return "bg-[linear-gradient(135deg,#DBEAFE_25%,transparent_25%,transparent_50%,#DBEAFE_50%,#DBEAFE_75%,transparent_75%,transparent)] bg-[size:20px_20px]";
      case "Europe":
        return "bg-[linear-gradient(90deg,transparent_50%,#DCFCE7_50%)] bg-[size:20px_20px]";
      case "LatAm":
        return "bg-[radial-gradient(#FEF3C7_1px,transparent_1px)] bg-[size:20px_20px]";
      case "Asia":
        return "bg-[linear-gradient(45deg,#F5D0FE_25%,transparent_25%,transparent_50%,#F5D0FE_50%,#F5D0FE_75%,transparent_75%,transparent)] bg-[size:20px_20px]";
      default:
        return "bg-[radial-gradient(#F3F4F6_1px,transparent_1px)] bg-[size:20px_20px]";
    }
  };

  return (
    <div
      className={`absolute inset-0 opacity-10 ${getRegionPattern(
        region
      )} ${className}`}
      aria-hidden="true"
    />
  );
}
