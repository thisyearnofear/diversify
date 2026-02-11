/**
 * StrategyMetrics - Display metrics aligned with user's financial philosophy
 * ENHANCED VERSION with delightful micro-interactions
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useAppState } from '@/context/AppStateContext';
import type { FinancialStrategy } from '@/context/AppStateContext';

interface StrategyMetric {
    label: string;
    value: string | number;
    icon: string;
    description: string;
    status?: 'good' | 'warning' | 'neutral';
}

interface StrategyMetricsProps {
    portfolioData: {
        regions: Record<string, number>;
        chains: string[];
        tokens: Array<{ symbol: string; balance: string | number; value?: number }>;
    };
}

export default function StrategyMetrics({ portfolioData }: StrategyMetricsProps) {
    const { financialStrategy } = useAppState();

    if (!financialStrategy) {
        return (
            <motion.div
                className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <p className="text-sm text-blue-900 dark:text-blue-100">
                    💡 Select your financial philosophy to see personalized metrics
                </p>
            </motion.div>
        );
    }

    const metrics = getMetricsForStrategy(financialStrategy, portfolioData);

    return (
        <div className="space-y-3">
            <motion.div
                className="flex items-center gap-2 mb-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
            >
                <motion.span
                    className="text-2xl"
                    animate={{
                        rotate: [0, -10, 10, -10, 0],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 5
                    }}
                >
                    {getStrategyIcon(financialStrategy)}
                </motion.span>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                    {getStrategyName(financialStrategy)} Metrics
                </h3>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {metrics.map((metric, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, type: "spring" }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        className={`p-4 rounded-xl border-2 cursor-default transition-shadow hover:shadow-lg ${metric.status === 'good'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : metric.status === 'warning'
                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <motion.span
                                className="text-2xl"
                                whileHover={{ scale: 1.2, rotate: 10 }}
                                transition={{ type: "spring", stiffness: 400 }}
                            >
                                {metric.icon}
                            </motion.span>
                            <motion.span
                                className="text-2xl font-black text-gray-900 dark:text-white"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.08 + 0.2, type: "spring", stiffness: 200 }}
                            >
                                {metric.value}
                            </motion.span>
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                            {metric.label}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            {metric.description}
                        </p>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// Import all the helper functions from original file
function getMetricsForStrategy(
    strategy: FinancialStrategy,
    data: StrategyMetricsProps['portfolioData']
): StrategyMetric[] {
    switch (strategy) {
        case 'africapitalism':
            return getAfricapitalismMetrics(data);
        case 'buen_vivir':
            return getBuenVivirMetrics(data);
        case 'confucian':
            return getConfucianMetrics(data);
        case 'gotong_royong':
            return getGotongRoyongMetrics(data);
        case 'islamic':
            return getIslamicMetrics(data);
        case 'global':
            return getGlobalMetrics(data);
        case 'custom':
            return getCustomMetrics(data);
        default:
            return [];
    }
}

function getAfricapitalismMetrics(data: StrategyMetricsProps['portfolioData']): StrategyMetric[] {
    const africanRegions = ['West Africa', 'East Africa', 'Southern Africa', 'North Africa'];
    const africanExposure = africanRegions.reduce((sum, region) => sum + (data.regions[region] || 0), 0);
    const africanCountries = Object.keys(data.regions).filter(r => africanRegions.includes(r)).length;

    return [
        {
            label: 'Pan-African Exposure',
            value: `${africanExposure.toFixed(0)}%`,
            icon: '🌍',
            description: 'Wealth invested in African economies',
            status: africanExposure > 50 ? 'good' : africanExposure > 25 ? 'neutral' : 'warning',
        },
        {
            label: 'African Countries',
            value: africanCountries,
            icon: '🗺️',
            description: 'Diversified across African regions',
            status: africanCountries >= 3 ? 'good' : africanCountries >= 2 ? 'neutral' : 'warning',
        },
        {
            label: 'Ubuntu Score',
            value: africanExposure > 60 ? 'Strong' : africanExposure > 30 ? 'Growing' : 'Building',
            icon: '🤝',
            description: 'Community wealth building',
            status: africanExposure > 60 ? 'good' : 'neutral',
        },
        {
            label: 'Motherland First',
            value: africanExposure > 75 ? '✓' : '○',
            icon: '🏠',
            description: 'Keeping wealth in Africa',
            status: africanExposure > 75 ? 'good' : 'neutral',
        },
    ];
}

function getBuenVivirMetrics(data: StrategyMetricsProps['portfolioData']): StrategyMetric[] {
    const latamRegions = ['South America', 'Central America', 'Caribbean'];
    const latamExposure = latamRegions.reduce((sum, region) => sum + (data.regions[region] || 0), 0);
    const latamCountries = Object.keys(data.regions).filter(r => latamRegions.includes(r)).length;

    return [
        {
            label: 'Patria Grande',
            value: `${latamExposure.toFixed(0)}%`,
            icon: '🌎',
            description: 'Regional integration portfolio',
            status: latamExposure > 50 ? 'good' : latamExposure > 25 ? 'neutral' : 'warning',
        },
        {
            label: 'LatAm Countries',
            value: latamCountries,
            icon: '🗺️',
            description: 'Supporting regional sovereignty',
            status: latamCountries >= 3 ? 'good' : latamCountries >= 2 ? 'neutral' : 'warning',
        },
        {
            label: 'Harmony Balance',
            value: latamExposure > 40 && latamExposure < 80 ? 'Balanced' : 'Adjusting',
            icon: '⚖️',
            description: 'Material & community balance',
            status: latamExposure > 40 && latamExposure < 80 ? 'good' : 'neutral',
        },
        {
            label: 'Dollar Independence',
            value: latamExposure > 60 ? 'Strong' : 'Building',
            icon: '🆓',
            description: 'Reducing dollar dependence',
            status: latamExposure > 60 ? 'good' : 'neutral',
        },
    ];
}

function getConfucianMetrics(data: StrategyMetricsProps['portfolioData']): StrategyMetric[] {
    const totalValue = data.tokens.reduce((sum, t) => {
        const value = typeof t.balance === 'number' ? t.balance : (t.value || 0);
        return sum + value;
    }, 0);

    return [
        {
            label: 'Family Wealth',
            value: `$${totalValue.toFixed(0)}`,
            icon: '🏮',
            description: 'Multi-generational savings',
            status: totalValue > 1000 ? 'good' : totalValue > 100 ? 'neutral' : 'warning',
        },
        {
            label: 'Thrift Practice',
            value: 'Active',
            icon: '💰',
            description: 'Consistent saving habit',
            status: 'good',
        },
        {
            label: 'Long-term Focus',
            value: '✓',
            icon: '📅',
            description: 'Building for generations',
            status: 'good',
        },
        {
            label: 'Filial Duty',
            value: 'Honored',
            icon: '👨‍👩‍👧‍👦',
            description: 'Supporting family obligations',
            status: 'good',
        },
    ];
}

function getGotongRoyongMetrics(data: StrategyMetricsProps['portfolioData']): StrategyMetric[] {
    const seAsiaRegions = ['Southeast Asia'];
    const seAsiaExposure = seAsiaRegions.reduce((sum, region) => sum + (data.regions[region] || 0), 0);

    return [
        {
            label: 'Community Support',
            value: 'Active',
            icon: '🤝',
            description: 'Mutual aid participation',
            status: 'good',
        },
        {
            label: 'Remittance Ready',
            value: data.chains.length >= 2 ? '✓' : '○',
            icon: '💸',
            description: 'Multi-chain for transfers',
            status: data.chains.length >= 2 ? 'good' : 'neutral',
        },
        {
            label: 'Regional Ties',
            value: `${seAsiaExposure.toFixed(0)}%`,
            icon: '🌏',
            description: 'Southeast Asia exposure',
            status: seAsiaExposure > 30 ? 'good' : 'neutral',
        },
        {
            label: 'Bayanihan Spirit',
            value: 'Strong',
            icon: '🏠',
            description: 'Shared prosperity focus',
            status: 'good',
        },
    ];
}

function getIslamicMetrics(data: StrategyMetricsProps['portfolioData']): StrategyMetric[] {
    const hasGold = data.tokens.some(t => t.symbol.includes('PAX') || t.symbol.includes('GOLD'));
    const totalValue = data.tokens.reduce((sum, t) => {
        const value = typeof t.balance === 'number' ? t.balance : (t.value || 0);
        return sum + value;
    }, 0);
    const zakatDue = totalValue * 0.025;

    return [
        {
            label: 'Sharia Compliance',
            value: '✓',
            icon: '☪️',
            description: 'Halal investment focus',
            status: 'good',
        },
        {
            label: 'Asset-Backed',
            value: hasGold ? '✓' : '○',
            icon: '🪙',
            description: 'Real asset holdings',
            status: hasGold ? 'good' : 'neutral',
        },
        {
            label: 'Zakat Due',
            value: `$${zakatDue.toFixed(2)}`,
            icon: '🤲',
            description: 'Annual charity obligation',
            status: 'neutral',
        },
        {
            label: 'Riba-Free',
            value: '✓',
            icon: '🚫',
            description: 'No interest-bearing assets',
            status: 'good',
        },
    ];
}

function getGlobalMetrics(data: StrategyMetricsProps['portfolioData']): StrategyMetric[] {
    const regionCount = Object.keys(data.regions).length;
    const maxRegionExposure = Math.max(...Object.values(data.regions));

    return [
        {
            label: 'Global Reach',
            value: regionCount,
            icon: '🌐',
            description: 'Regions covered',
            status: regionCount >= 5 ? 'good' : regionCount >= 3 ? 'neutral' : 'warning',
        },
        {
            label: 'Diversification',
            value: maxRegionExposure < 40 ? 'Excellent' : maxRegionExposure < 60 ? 'Good' : 'Concentrated',
            icon: '📊',
            description: 'Risk distribution',
            status: maxRegionExposure < 40 ? 'good' : maxRegionExposure < 60 ? 'neutral' : 'warning',
        },
        {
            label: 'Chain Coverage',
            value: data.chains.length,
            icon: '🔗',
            description: 'Blockchain networks',
            status: data.chains.length >= 3 ? 'good' : data.chains.length >= 2 ? 'neutral' : 'warning',
        },
        {
            label: 'Currency Hedge',
            value: regionCount >= 4 ? 'Strong' : 'Building',
            icon: '🛡️',
            description: 'Geographic risk hedge',
            status: regionCount >= 4 ? 'good' : 'neutral',
        },
    ];
}

function getCustomMetrics(data: StrategyMetricsProps['portfolioData']): StrategyMetric[] {
    const regionCount = Object.keys(data.regions).length;
    const totalValue = data.tokens.reduce((sum, t) => {
        const value = typeof t.balance === 'number' ? t.balance : (t.value || 0);
        return sum + value;
    }, 0);

    return [
        {
            label: 'Your Strategy',
            value: '✓',
            icon: '🎯',
            description: 'Custom approach active',
            status: 'good',
        },
        {
            label: 'Portfolio Value',
            value: `$${totalValue.toFixed(0)}`,
            icon: '💰',
            description: 'Total holdings',
            status: totalValue > 100 ? 'good' : 'neutral',
        },
        {
            label: 'Regions',
            value: regionCount,
            icon: '🗺️',
            description: 'Geographic spread',
            status: regionCount >= 3 ? 'good' : 'neutral',
        },
        {
            label: 'Chains',
            value: data.chains.length,
            icon: '🔗',
            description: 'Network diversity',
            status: data.chains.length >= 2 ? 'good' : 'neutral',
        },
    ];
}

function getStrategyIcon(strategy: FinancialStrategy): string {
    const icons: Record<NonNullable<FinancialStrategy>, string> = {
        africapitalism: '🌍',
        buen_vivir: '🌎',
        confucian: '🏮',
        gotong_royong: '🤝',
        islamic: '☪️',
        global: '🌐',
        custom: '🎯',
    };
    return strategy ? icons[strategy] : '📊';
}

function getStrategyName(strategy: FinancialStrategy): string {
    const names: Record<NonNullable<FinancialStrategy>, string> = {
        africapitalism: 'Africapitalism',
        buen_vivir: 'Buen Vivir',
        confucian: 'Family Wealth',
        gotong_royong: 'Mutual Aid',
        islamic: 'Islamic Finance',
        global: 'Global',
        custom: 'Custom',
    };
    return strategy ? names[strategy] : 'Strategy';
}
