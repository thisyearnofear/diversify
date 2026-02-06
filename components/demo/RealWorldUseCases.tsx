import React from "react";

const USE_CASES = [
  {
    title: "Protection from Local Currency Devaluation",
    description:
      "When the Kenyan Shilling lost 20% of its value against the USD in 2022, Kenyans who had diversified into EURm and USDm preserved more of their savings.",
    icon: "🛡️",
    region: "Africa",
  },
  {
    title: "Remittance Cost Savings",
    description:
      "A Filipino worker sending money home from the US can save up to 7% in fees by using a mix of USDm and PHPm instead of traditional remittance services.",
    icon: "💸",
    region: "Asia",
  },
  {
    title: "Business Import/Export Protection",
    description:
      "A Colombian business that imports goods from Europe can hold EURm to protect against COPm/EURm exchange rate fluctuations.",
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-6">
      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Wealth Outcomes</h2>
        <span className="text-[10px] font-bold text-gray-400 uppercase">WORLD BANK DATA</span>
      </div>

      <div className="space-y-3">
        {filteredCases.map((useCase, index) => (
          <div
            key={index}
            className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-50 dark:border-gray-800 hover:border-blue-100 dark:hover:border-blue-900 transition-colors group"
          >
            <div className="flex items-start">
              <div className="text-2xl mr-4 group-hover:scale-110 transition-transform duration-300">{useCase.icon}</div>
              <div>
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight mb-1">{useCase.title}</h3>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                  {useCase.description}
                </p>
                {useCase.region !== "Global" && (
                  <div className="mt-2">
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                      {useCase.region}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 p-4 bg-gray-900 rounded-2xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-12 -mt-12" />
        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 relative">WHY IT MATTERS</h3>
        <p className="text-[11px] font-bold text-white leading-relaxed relative">
          In many emerging markets, local currencies can lose 10-30% of their
          value in a single year. Geographic diversification is the <span className="text-blue-400">ultimate hedge</span>.
        </p>
      </div>
    </div>
  );
}
