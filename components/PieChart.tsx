
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

// Register the required chart.js components
Chart.register(ArcElement, Tooltip, Legend);

interface PieChartProps {
  data: {
    region: string;
    value: number;
    color: string;
  }[];
  title?: string;
}

export default function PieChart({ data, title = 'Portfolio Distribution' }: PieChartProps) {
  // Format data for Chart.js
  const chartData = {
    labels: data.map(item => item.region),
    datasets: [
      {
        data: data.map(item => item.value),
        backgroundColor: data.map(item => item.color),
        borderColor: data.map(item => item.color),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${percentage}%`;
          }
        }
      }
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="chart-container">
        <Pie data={chartData} options={options} />
      </div>
    </div>
  );
}
