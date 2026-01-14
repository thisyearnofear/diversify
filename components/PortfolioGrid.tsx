interface PortfolioGridProps {
  portfolioItems: {
    token: string;
    symbol: string;
    region: string;
    balance: string;
    value: number;
    percentage: number;
  }[];
  title?: string;
}

export default function PortfolioGrid({ 
  portfolioItems, 
  title = 'Portfolio Holdings' 
}: PortfolioGridProps) {
  // Sort items by value (descending)
  const sortedItems = [...portfolioItems].sort((a, b) => b.value - a.value);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Token
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Region
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Balance
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Value (USD)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                % of Portfolio
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedItems.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {item.symbol}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {item.region}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {item.balance}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  ${item.value.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  <div className="flex items-center">
                    <span className="mr-2">{item.percentage.toFixed(1)}%</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {portfolioItems.length === 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          No portfolio data available. Connect your wallet to view your holdings.
        </div>
      )}
    </div>
  );
}
