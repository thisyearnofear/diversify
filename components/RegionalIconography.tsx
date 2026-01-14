import React from "react";
import type { Region } from "../hooks/use-user-region";

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

  // Get region-specific icon and background color
  const getRegionStyles = (region: Region) => {
    switch (region) {
      case "Africa":
        return {
          bgColor: "bg-region-africa-light",
          textColor: "text-region-africa-dark",
          borderColor: "border-region-africa-medium",
          icon: "🌍", // Africa globe
          pattern: "bg-[url('/images/patterns/africa-pattern.svg')]",
          alt: "African pattern",
        };
      case "USA":
        return {
          bgColor: "bg-region-usa-light",
          textColor: "text-region-usa-dark",
          borderColor: "border-region-usa-medium",
          icon: "🏙️", // City skyline
          pattern: "bg-[url('/images/patterns/usa-pattern.svg')]",
          alt: "USA pattern",
        };
      case "Europe":
        return {
          bgColor: "bg-region-europe-light",
          textColor: "text-region-europe-dark",
          borderColor: "border-region-europe-medium",
          icon: "🏰", // Castle
          pattern: "bg-[url('/images/patterns/europe-pattern.svg')]",
          alt: "European pattern",
        };
      case "LatAm":
        return {
          bgColor: "bg-region-latam-light",
          textColor: "text-region-latam-dark",
          borderColor: "border-region-latam-medium",
          icon: "🌴", // Palm tree
          pattern: "bg-[url('/images/patterns/latam-pattern.svg')]",
          alt: "Latin American pattern",
        };
      case "Asia":
        return {
          bgColor: "bg-region-asia-light",
          textColor: "text-region-asia-dark",
          borderColor: "border-region-asia-medium",
          icon: "🏮", // Lantern
          pattern: "bg-[url('/images/patterns/asia-pattern.svg')]",
          alt: "Asian pattern",
        };
      default:
        return {
          bgColor: "bg-gray-100",
          textColor: "text-gray-700",
          borderColor: "border-gray-300",
          icon: "🌎", // Globe
          pattern: "",
          alt: "Global pattern",
        };
    }
  };

  const regionStyles = getRegionStyles(region);

  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 ${regionStyles.borderColor} ${regionStyles.bgColor} ${sizeClasses[size]} ${className}`}
      title={`${region} region`}
    >
      <span className="text-2xl" role="img" aria-label={regionStyles.alt}>
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
