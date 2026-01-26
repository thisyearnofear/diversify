interface DiversificationMetricsProps {
  metrics: {
    name: string;
    value: number;
    description: string;
    interpretation: string;
    color: string;
  }[];
  title?: string;
}

export default function DiversificationMetrics({ 
  metrics, 
  title = 'Diversification Metrics' 
}: DiversificationMetricsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <div 
            key={index} 
            className="border rounded-lg p-4"
            style={{ borderColor: metric.color }}
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-gray-900 dark:text-white">{metric.name}</h4>
              <span 
                className="text-lg font-bold"
                style={{ color: metric.color }}
              >
                {metric.value.toFixed(2)}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {metric.description}
            </p>
            <p className="text-xs italic text-gray-500 dark:text-gray-400">
              {metric.interpretation}
            </p>
          </div>
        ))}
      </div>
      
      {metrics.length === 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          No metrics available. Connect your wallet to view diversification metrics.
        </div>
      )}
    </div>
  );
}
