import React from "react";
import type { Region } from "../../hooks/use-user-region";
import { RegionalPattern } from "../regional/RegionalIconography";
import RegionalIconography from "../regional/RegionalIconography";
import { REGION_COLORS } from "../../config";

interface RealLifeScenarioProps {
  region: Region;
  targetRegion?: Region;
  scenarioType: "education" | "remittance" | "business" | "travel" | "savings";
  inflationRate?: number;
  targetInflationRate?: number;
  amount?: number;  // Kept for API compatibility
  monthlyAmount?: number;
}

/**
 * Component that displays real-life scenarios showing how inflation affects daily life
 * and how stablecoin diversification can help
 */
export default function RealLifeScenario({
  region,
  targetRegion,
  scenarioType,
  inflationRate = 5,
  targetInflationRate,
  amount = 1000,  // Unused but kept for API compatibility
  monthlyAmount = 100,
}: RealLifeScenarioProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _amount = amount; // Mark as intentionally unused
  // Calculate the impact of inflation on the amount over 1 year
  // const yearlyAmount = monthlyAmount * 12;
  const lostValue = monthlyAmount * 12 * (inflationRate / 100);

  // Calculate potential savings if swapping to target region
  const targetInflation = targetInflationRate || (inflationRate > 2 ? 2 : 1);
  // const targetLostValue = yearlyAmount * (targetInflation / 100);
  const potentialSavings = lostValue - monthlyAmount * 12 * (targetInflation / 100);
  const hasSavings = potentialSavings > 0;

  // Get scenario-specific content
  const getScenarioContent = () => {
    const baseTitle =
      {
        education: "Education Expenses",
        remittance: "Family Support",
        business: "Business Operations",
        travel: "Travel Plans",
        savings: "Savings Goals",
      }[scenarioType] || "Daily Expenses";

    const baseIcon =
      {
        education: "🎓",
        remittance: "👪",
        business: "🏪",
        travel: "✈️",
        savings: "💰",
      }[scenarioType] || "🛒";

    const baseAction =
      {
        education: "education fund",
        remittance: "remittance value",
        business: "business funds",
        travel: "travel budget",
        savings: "savings",
      }[scenarioType] || "money";

    // Create more concise descriptions
    let description = "";
    const actionVerb = scenarioType === "remittance" ? "Sending" : "Saving";

    if (targetRegion) {
      // Improved clarity for the description
      const savingsText = hasSavings 
        ? `Swapping to ${targetRegion} stablecoins could save you $${potentialSavings.toFixed(0)}/year.`
        : `Swapping to ${targetRegion} stablecoins changes your inflation exposure.`;
        
      description = `${actionVerb} $${monthlyAmount}/month in ${region} results in an annual value loss of $${lostValue.toFixed(0)} due to inflation. ${savingsText}`;
    } else {
      description = `${actionVerb} $${monthlyAmount}/month loses $${lostValue.toFixed(
        0
      )}/year to inflation in ${region}.`;
    }

    return {
      title: baseTitle,
      icon: baseIcon,
      description: description,
      action: `Protect your ${baseAction}`,
    };
  };

  const scenarioContent = getScenarioContent();

  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <RegionalPattern region={region} className="opacity-10" />
      <div className="relative">
        {/* Compact header */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-base" role="img" aria-label={scenarioContent.title}>
            {scenarioContent.icon}
          </span>
          <h3 className="font-bold text-sm text-gray-900 leading-tight">
            {scenarioContent.title}
          </h3>
        </div>

        {/* Compact description */}
        <p className="text-[11px] text-gray-600 mb-2 leading-snug">
          {scenarioContent.description}
        </p>

        <div className="bg-gray-50 px-2 py-2 rounded-lg border border-gray-200">
          {/* Single compact row: metrics + region icons + button */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            {/* Metrics */}
            <div className="flex items-center gap-1.5">
              {/* Monthly */}
              <div className="flex flex-col items-center bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-sm min-w-[40px]">
                <div className="text-[8px] text-gray-500 font-black uppercase tracking-wide leading-none mb-0.5">Monthly</div>
                <div className="font-black text-sm text-gray-900">${monthlyAmount}</div>
              </div>
              <span className="text-gray-300 text-xs font-bold">→</span>
              {/* Annual Loss */}
              <div className="flex flex-col items-center bg-red-50 px-2 py-1 rounded-lg border border-red-100 shadow-sm min-w-[40px]">
                <div className="text-[8px] text-red-600 font-black uppercase tracking-wide leading-none mb-0.5">Loss/yr</div>
                <div className="font-black text-sm text-red-600">-${lostValue.toFixed(0)}</div>
              </div>
              {/* Potential Gain */}
              {targetRegion && hasSavings && (
                <>
                  <span className="text-gray-300 text-xs font-bold">→</span>
                  <div className="flex flex-col items-center bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 shadow-sm min-w-[40px]">
                    <div className="text-[8px] text-emerald-600 font-black uppercase tracking-wide leading-none mb-0.5">Save/yr</div>
                    <div className="font-black text-sm text-emerald-600">+${potentialSavings.toFixed(0)}</div>
                  </div>
                </>
              )}
            </div>

            {/* Region icons + action button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {targetRegion && (
                <div className="flex items-center">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                    style={{ backgroundColor: REGION_COLORS[region as keyof typeof REGION_COLORS] }}
                  >
                    <RegionalIconography region={region} size="sm" className="text-white" />
                  </div>
                  <span className="mx-0.5 text-[10px] text-gray-400">→</span>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                    style={{ backgroundColor: REGION_COLORS[targetRegion as keyof typeof REGION_COLORS] }}
                  >
                    <RegionalIconography region={targetRegion} size="sm" className="text-white" />
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  const swapElement = document.querySelector(".SwapInterface");
                  if (swapElement) swapElement.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="px-2.5 py-1.5 text-[10px] rounded-lg bg-blue-600 text-white font-black shadow-sm hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 uppercase tracking-wide whitespace-nowrap"
              >
                {scenarioContent.action}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Region-specific education scenarios
// function getEducationScenario(region: Region, lostValue: number): string {
//   switch (region) {
//     case "Africa":
//       return `Inflation could reduce your child's school supplies budget by $${lostValue.toFixed(
//         0
//       )} this year, affecting their education quality.`;
//     case "USA":
//       return `Your college savings will lose $${lostValue.toFixed(
//         0
//       )} to inflation this year, potentially reducing future educational opportunities.`;
//     case "Europe":
//       return `Your university fund will lose $${lostValue.toFixed(
//         0
//       )} in value, which could mean fewer textbooks or resources for your studies.`;
//     case "LatAm":
//       return `High inflation could reduce your education budget by $${lostValue.toFixed(
//         0
//       )}, making it harder to afford quality courses or materials.`;
//     case "Asia":
//       return `Your education savings will lose $${lostValue.toFixed(
//         0
//       )} in purchasing power, potentially affecting your ability to pay for extra classes.`;
//     default:
//       return `Inflation will reduce your education fund by $${lostValue.toFixed(
//         0
//       )} this year.`;
//   }
// }

// Region-specific remittance scenarios
// function getRemittanceScenario(region: Region, lostValue: number): string {
//   switch (region) {
//     case "Africa":
//       return `When sending money to family, inflation could reduce the value by $${lostValue.toFixed(
//         0
//       )} yearly, affecting their ability to buy essentials.`;
//     case "USA":
//       return `Money sent to relatives abroad will lose $${lostValue.toFixed(
//         0
//       )} in value due to inflation, reducing their purchasing power.`;
//     case "Europe":
//       return `Your family support payments will lose $${lostValue.toFixed(
//         0
//       )} in value, potentially affecting your relatives' quality of life.`;
//     case "LatAm":
//       return `Money sent to family members could lose $${lostValue.toFixed(
//         0
//       )} in purchasing power, making it harder for them to cover basic needs.`;
//     case "Asia":
//       return `Your remittances will lose $${lostValue.toFixed(
//         0
//       )} in value due to inflation, potentially reducing the support you can provide to family.`;
//     default:
//       return `Inflation will reduce your remittances by $${lostValue.toFixed(
//         0
//       )} this year.`;
//   }
// }

// Region-specific business scenarios
// function getBusinessScenario(region: Region, lostValue: number): string {
//   switch (region) {
//     case "Africa":
//       return `Your small business inventory budget will lose $${lostValue.toFixed(
//         0
//       )} in purchasing power, potentially reducing your stock levels.`;
//     case "USA":
//       return `Your business operating funds will lose $${lostValue.toFixed(
//         0
//       )} to inflation, potentially affecting your ability to invest in growth.`;
//     case "Europe":
//       return `Your business reserves will lose $${lostValue.toFixed(
//         0
//       )} in value, which could impact your ability to handle unexpected expenses.`;
//     case "LatAm":
//       return `High inflation could reduce your business capital by $${lostValue.toFixed(
//         0
//       )}, making it harder to maintain inventory levels.`;
//     case "Asia":
//       return `Your business savings will lose $${lostValue.toFixed(
//         0
//       )} in purchasing power, potentially affecting your ability to pay suppliers.`;
//     default:
//       return `Inflation will reduce your business funds by $${lostValue.toFixed(
//         0
//       )} this year.`;
//   }
// }

// Region-specific travel scenarios
// function getTravelScenario(region: Region, lostValue: number): string {
//   switch (region) {
//     case "Africa":
//       return `Your travel budget will lose $${lostValue.toFixed(
//         0
//       )} in value, potentially limiting your ability to visit family abroad.`;
//     case "USA":
//       return `Your vacation fund will lose $${lostValue.toFixed(
//         0
//       )} to inflation, which could mean fewer days traveling or less comfortable accommodations.`;
//     case "Europe":
//       return `Your holiday savings will lose $${lostValue.toFixed(
//         0
//       )} in value, potentially affecting your travel plans or destination choices.`;
//     case "LatAm":
//       return `Inflation could reduce your travel budget by $${lostValue.toFixed(
//         0
//       )}, making international trips more expensive.`;
//     case "Asia":
//       return `Your travel savings will lose $${lostValue.toFixed(
//         0
//       )} in purchasing power, potentially limiting your ability to explore new places.`;
//     default:
//       return `Inflation will reduce your travel budget by $${lostValue.toFixed(
//         0
//       )} this year.`;
//   }
// }

// Region-specific savings scenarios
// function getSavingsScenario(region: Region, lostValue: number): string {
//   switch (region) {
//     case "Africa":
//       return `Your emergency savings will lose $${lostValue.toFixed(
//         0
//       )} in purchasing power, reducing your financial safety net.`;
//     case "USA":
//       return `Your savings account will lose $${lostValue.toFixed(
//         0
//       )} to inflation this year, silently eroding your financial security.`;
//     case "Europe":
//       return `Your savings will lose $${lostValue.toFixed(
//         0
//       )} in value, which means less money for future needs or opportunities.`;
//     case "LatAm":
//       return `High inflation could reduce your savings by $${lostValue.toFixed(
//         0
//       )}, making it harder to achieve your financial goals.`;
//     case "Asia":
//       return `Your savings will lose $${lostValue.toFixed(
//         0
//       )} in purchasing power, potentially affecting your long-term financial plans.`;
//     default:
//       return `Inflation will reduce your savings by $${lostValue.toFixed(
//         0
//       )} this year.`;
//   }
// }
