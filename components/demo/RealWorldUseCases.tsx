import React from "react";

const USE_CASES = [
  {
    title: "Protection from Local Currency Devaluation",
    description:
      "When the Kenyan Shilling lost 20% of its value against the USD in 2022, Kenyans who had diversified into cEUR and cUSD preserved more of their savings.",
    icon: "🛡️",
    region: "Africa",
  },
  {
    title: "Remittance Cost Savings",
    description:
      "A Filipino worker sending money home from the US can save up to 7% in fees by using a mix of cUSD and PUSO instead of traditional remittance services.",
    icon: "💸",
    region: "Asia",
  },
  {
    title: "Business Import/Export Protection",
    description:
      "A Colombian business that imports goods from Europe can hold cEUR to protect against COP/EUR exchange rate fluctuations.",
    icon: "🏭",
    region: "LatAm",
  },
  {
    title: "Education Fund Preservation",
    description:
      "Parents saving for international education can hold stablecoins from the region where their children plan to study, protecting against currency fluctuations.",
    icon: "🎓",
    region: "Global",
  },
  {
    title: "Travel Expense Management",
    description:
      "Frequent travelers can hold stablecoins from regions they visit regularly, avoiding exchange rate losses and conversion fees.",
    icon: "✈️",
    region: "Global",
  },
];

interface RealWorldUseCasesProps {
  focusRegion?: string;
}

export default function RealWorldUseCases({
  focusRegion,
}: RealWorldUseCasesProps) {
  // Filter use cases if a focus region is provided
  const filteredCases = focusRegion
    ? USE_CASES.filter(
        (useCase) =>
          useCase.region === focusRegion || useCase.region === "Global"
      )
    : USE_CASES;

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Real-World Benefits</h2>
        <span className="text-xs text-gray-500">Based on World Bank data</span>
      </div>

      <p className="text-gray-600 mb-4">
        Examples of how stablecoin diversification helps protect savings:
      </p>

      <div className="space-y-3">
        {filteredCases.map((useCase, index) => (
          <div
            key={index}
            className="bg-gray-50 p-3 rounded-md border border-gray-100"
          >
            <div className="flex items-start">
              <div className="text-2xl mr-3">{useCase.icon}</div>
              <div>
                <h3 className="font-medium text-gray-900">{useCase.title}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {useCase.description}
                </p>
                {useCase.region !== "Global" && (
                  <div className="mt-2">
                    <span className="inline-block text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {useCase.region}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-blue-50 p-3 rounded-md">
        <h3 className="font-medium text-blue-700 mb-1">Why This Matters</h3>
        <p className="text-sm text-blue-600">
          In many emerging markets, local currencies can lose 10-30% of their
          value in a single year due to inflation and devaluation. Diversifying
          across stablecoins from different regions provides a practical way to
          preserve purchasing power.
        </p>
      </div>
    </div>
  );
}
