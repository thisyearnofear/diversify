import React from "react";
import type { Region } from "../hooks/use-user-region";
import { RegionalPattern } from "./RegionalIconography";
import RegionalIconography from "./RegionalIconography";
import { REGION_COLORS } from "../constants/regions";

interface RealLifeScenarioProps {
  region: Region;
  targetRegion?: Region;
  scenarioType: "education" | "remittance" | "business" | "travel" | "savings";
  inflationRate?: number;
  targetInflationRate?: number;
  amount?: number;
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
  amount = 1000,
  monthlyAmount = 100,
}: RealLifeScenarioProps) {
  // Calculate the impact of inflation on the amount over 1 year
  const yearlyAmount = monthlyAmount * 12;
  const lostValue = yearlyAmount * (inflationRate / 100);

  // Calculate potential savings if swapping to target region
  const targetInflation = targetInflationRate || (inflationRate > 2 ? 2 : 1);
  const targetLostValue = yearlyAmount * (targetInflation / 100);
  const potentialSavings = lostValue - targetLostValue;
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
      // More concise for mobile
      description = `${actionVerb} $${monthlyAmount}/month loses $${lostValue.toFixed(
        0
      )}/year to inflation in ${region}. Swap to ${targetRegion} stablecoins to save $${potentialSavings.toFixed(
        0
      )}/year.`;
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
    <div className="relative overflow-hidden rounded-lg border-2 border-gray-200 bg-white p-4 shadow-md">
      <RegionalPattern region={region} className="opacity-10" />
      <div className="relative">
        {/* Enhanced header with better visibility */}
        <div className="flex items-center mb-3">
          <span
            className="text-2xl mr-2 bg-gray-100 p-2 rounded-md"
            role="img"
            aria-label={scenarioContent.title}
          >
            {scenarioContent.icon}
          </span>
          <h3 className="font-bold text-lg text-gray-900">
            {scenarioContent.title}
          </h3>
        </div>

        {/* More concise description with better contrast */}
        <p className="text-sm text-gray-700 mb-4 font-medium leading-tight">
          {scenarioContent.description}
        </p>

        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          {/* Mobile-friendly layout with stacked elements */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
            {/* First row: Metrics */}
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-3 mb-3 sm:mb-0">
              {/* Monthly amount */}
              <div className="flex items-center justify-between sm:justify-start sm:flex-col bg-white p-2 rounded-md">
                <div className="text-sm text-gray-500 font-medium">
                  Monthly amount
                </div>
                <div className="font-bold text-lg text-gray-900">
                  ${monthlyAmount}
                </div>
              </div>

              {/* Arrow - only visible on desktop */}
              <div className="mx-1 text-gray-400 hidden sm:block">→</div>

              {/* Yearly loss */}
              <div className="flex items-center justify-between sm:justify-start sm:flex-col bg-white p-2 rounded-md">
                <div className="text-sm text-gray-500 font-medium">
                  Yearly loss
                </div>
                <div className="font-bold text-lg text-red-600">
                  -${lostValue.toFixed(0)}
                </div>
              </div>

              {/* Potential savings (if applicable) */}
              {targetRegion && hasSavings && (
                <>
                  {/* Arrow - only visible on desktop */}
                  <div className="mx-1 text-gray-400 hidden sm:block">→</div>

                  <div className="flex items-center justify-between sm:justify-start sm:flex-col bg-white p-2 rounded-md">
                    <div className="text-sm text-gray-500 font-medium">
                      Potential savings
                    </div>
                    <div className="font-bold text-lg text-green-600">
                      +${potentialSavings.toFixed(0)}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Second row: Region icons and action button */}
            <div className="flex flex-col sm:flex-row items-center mt-4 sm:mt-0">
              {/* Region icons */}
              {targetRegion && (
                <div className="flex items-center mb-3 sm:mb-0 sm:mr-3">
                  <div
                    className="size-10 sm:size-8 rounded-full flex items-center justify-center mr-2 border-2 border-white shadow-sm"
                    style={{
                      backgroundColor:
                        REGION_COLORS[region as keyof typeof REGION_COLORS],
                    }}
                  >
                    <RegionalIconography
                      region={region}
                      size="sm"
                      className="text-white"
                    />
                  </div>
                  <span className="mx-2 text-lg sm:text-base">→</span>
                  <div
                    className="size-10 sm:size-8 rounded-full flex items-center justify-center ml-2 border-2 border-white shadow-sm"
                    style={{
                      backgroundColor:
                        REGION_COLORS[
                          targetRegion as keyof typeof REGION_COLORS
                        ],
                    }}
                  >
                    <RegionalIconography
                      region={targetRegion}
                      size="sm"
                      className="text-white"
                    />
                  </div>
                </div>
              )}

              {/* Action button */}
              <button
                onClick={() => {
                  // Scroll to the swap section
                  const swapElement = document.querySelector(".SwapInterface");
                  if (swapElement) {
                    swapElement.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }
                }}
                className={`w-full sm:w-auto px-4 py-2 text-sm rounded-md bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 transition-colors`}
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
function getEducationScenario(region: Region, lostValue: number): string {
  switch (region) {
    case "Africa":
      return `Inflation could reduce your child's school supplies budget by $${lostValue.toFixed(
        0
      )} this year, affecting their education quality.`;
    case "USA":
      return `Your college savings will lose $${lostValue.toFixed(
        0
      )} to inflation this year, potentially reducing future educational opportunities.`;
    case "Europe":
      return `Your university fund will lose $${lostValue.toFixed(
        0
      )} in value, which could mean fewer textbooks or resources for your studies.`;
    case "LatAm":
      return `High inflation could reduce your education budget by $${lostValue.toFixed(
        0
      )}, making it harder to afford quality courses or materials.`;
    case "Asia":
      return `Your education savings will lose $${lostValue.toFixed(
        0
      )} in purchasing power, potentially affecting your ability to pay for extra classes.`;
    default:
      return `Inflation will reduce your education fund by $${lostValue.toFixed(
        0
      )} this year.`;
  }
}

// Region-specific remittance scenarios
function getRemittanceScenario(region: Region, lostValue: number): string {
  switch (region) {
    case "Africa":
      return `When sending money to family, inflation could reduce the value by $${lostValue.toFixed(
        0
      )} yearly, affecting their ability to buy essentials.`;
    case "USA":
      return `Money sent to relatives abroad will lose $${lostValue.toFixed(
        0
      )} in value due to inflation, reducing their purchasing power.`;
    case "Europe":
      return `Your family support payments will lose $${lostValue.toFixed(
        0
      )} in value, potentially affecting your relatives' quality of life.`;
    case "LatAm":
      return `Money sent to family members could lose $${lostValue.toFixed(
        0
      )} in purchasing power, making it harder for them to cover basic needs.`;
    case "Asia":
      return `Your remittances will lose $${lostValue.toFixed(
        0
      )} in value due to inflation, potentially reducing the support you can provide to family.`;
    default:
      return `Inflation will reduce your remittances by $${lostValue.toFixed(
        0
      )} this year.`;
  }
}

// Region-specific business scenarios
function getBusinessScenario(region: Region, lostValue: number): string {
  switch (region) {
    case "Africa":
      return `Your small business inventory budget will lose $${lostValue.toFixed(
        0
      )} in purchasing power, potentially reducing your stock levels.`;
    case "USA":
      return `Your business operating funds will lose $${lostValue.toFixed(
        0
      )} to inflation, potentially affecting your ability to invest in growth.`;
    case "Europe":
      return `Your business reserves will lose $${lostValue.toFixed(
        0
      )} in value, which could impact your ability to handle unexpected expenses.`;
    case "LatAm":
      return `High inflation could reduce your business capital by $${lostValue.toFixed(
        0
      )}, making it harder to maintain inventory levels.`;
    case "Asia":
      return `Your business savings will lose $${lostValue.toFixed(
        0
      )} in purchasing power, potentially affecting your ability to pay suppliers.`;
    default:
      return `Inflation will reduce your business funds by $${lostValue.toFixed(
        0
      )} this year.`;
  }
}

// Region-specific travel scenarios
function getTravelScenario(region: Region, lostValue: number): string {
  switch (region) {
    case "Africa":
      return `Your travel budget will lose $${lostValue.toFixed(
        0
      )} in value, potentially limiting your ability to visit family abroad.`;
    case "USA":
      return `Your vacation fund will lose $${lostValue.toFixed(
        0
      )} to inflation, which could mean fewer days traveling or less comfortable accommodations.`;
    case "Europe":
      return `Your holiday savings will lose $${lostValue.toFixed(
        0
      )} in value, potentially affecting your travel plans or destination choices.`;
    case "LatAm":
      return `Inflation could reduce your travel budget by $${lostValue.toFixed(
        0
      )}, making international trips more expensive.`;
    case "Asia":
      return `Your travel savings will lose $${lostValue.toFixed(
        0
      )} in purchasing power, potentially limiting your ability to explore new places.`;
    default:
      return `Inflation will reduce your travel budget by $${lostValue.toFixed(
        0
      )} this year.`;
  }
}

// Region-specific savings scenarios
function getSavingsScenario(region: Region, lostValue: number): string {
  switch (region) {
    case "Africa":
      return `Your emergency savings will lose $${lostValue.toFixed(
        0
      )} in purchasing power, reducing your financial safety net.`;
    case "USA":
      return `Your savings account will lose $${lostValue.toFixed(
        0
      )} to inflation this year, silently eroding your financial security.`;
    case "Europe":
      return `Your savings will lose $${lostValue.toFixed(
        0
      )} in value, which means less money for future needs or opportunities.`;
    case "LatAm":
      return `High inflation could reduce your savings by $${lostValue.toFixed(
        0
      )}, making it harder to achieve your financial goals.`;
    case "Asia":
      return `Your savings will lose $${lostValue.toFixed(
        0
      )} in purchasing power, potentially affecting your long-term financial plans.`;
    default:
      return `Inflation will reduce your savings by $${lostValue.toFixed(
        0
      )} this year.`;
  }
}
