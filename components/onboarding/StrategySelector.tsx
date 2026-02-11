/**
 * StrategySelector - Cultural financial philosophy selection
 * 
 * Allows users to choose their authentic financial strategy based on
 * cultural values, not Western assumptions about "correct" diversification.
 * 
 * Core Principles:
 * - RESPECT: No strategy is "better" than another
 * - AUTHENTIC: Use real cultural philosophies
 * - EDUCATIONAL: Explain each approach
 * - FLEXIBLE: Users can change anytime
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';

export type FinancialStrategy =
    | 'africapitalism'
    | 'buen_vivir'
    | 'confucian'
    | 'gotong_royong'
    | 'islamic'
    | 'global'
    | 'custom';

interface Strategy {
    id: FinancialStrategy;
    name: string;
    nativeName?: string;
    icon: string;
    tagline: string;
    description: string;
    values: string[];
    example: string;
    regions: string[];
}

const STRATEGIES: Strategy[] = [
    {
        id: 'africapitalism',
        name: 'Africapitalism',
        nativeName: 'Ubuntu Economics',
        icon: '🌍',
        tagline: 'Build the motherland',
        description: 'Keep wealth in African economies to drive pan-African prosperity. Support local businesses and regional integration.',
        values: ['Community wealth', 'Pan-African unity', 'Local development'],
        example: 'Diversify across KESm, GHSm, ZARm, NGNm',
        regions: ['Africa'],
    },
    {
        id: 'buen_vivir',
        name: 'Buen Vivir',
        nativeName: 'Sumak Kawsay',
        icon: '🌎',
        tagline: 'Live in harmony',
        description: 'Balance material wealth with community well-being and environmental harmony. Support regional sovereignty.',
        values: ['Collective prosperity', 'Regional integration', 'Harmony with nature'],
        example: 'Focus on LatAm stablecoins: BRLm, COPm',
        regions: ['Latin America'],
    },
    {
        id: 'confucian',
        name: 'Family Wealth',
        nativeName: '家族财富',
        icon: '🏮',
        tagline: 'Honor generations',
        description: 'Build multi-generational family wealth through thrift, education, and long-term thinking. Support family obligations.',
        values: ['Filial piety', 'Long-term planning', 'Family first'],
        example: 'High savings, education funds, family pooling',
        regions: ['East Asia'],
    },
    {
        id: 'gotong_royong',
        name: 'Mutual Aid',
        nativeName: 'Gotong Royong / Bayanihan',
        icon: '🤝',
        tagline: 'Support community',
        description: 'Mutual cooperation and shared prosperity. Optimize remittances and support family across borders.',
        values: ['Community support', 'Remittances', 'Shared responsibility'],
        example: 'Optimize PHPm transfers, family pooling',
        regions: ['Southeast Asia'],
    },
    {
        id: 'islamic',
        name: 'Islamic Finance',
        nativeName: 'التمويل الإسلامي',
        icon: '☪️',
        tagline: 'Wealth as trust',
        description: 'Sharia-compliant wealth building. No interest, asset-backed investments, zakat-conscious portfolio.',
        values: ['Halal investments', 'No riba', 'Zakat obligation'],
        example: 'Asset-backed tokens, gold (PAXG), no interest',
        regions: ['Middle East', 'North Africa', 'Global'],
    },
    {
        id: 'global',
        name: 'Global Diversification',
        icon: '🌐',
        tagline: 'Spread worldwide',
        description: 'Maximize geographic diversification across continents. Hedge currency risk through global exposure.',
        values: ['Risk hedging', 'Global exposure', 'Currency diversification'],
        example: 'Spread across USA, Europe, LatAm, Africa, Asia',
        regions: ['Global'],
    },
    {
        id: 'custom',
        name: 'Custom Strategy',
        icon: '🎯',
        tagline: 'Your own path',
        description: 'Define your own financial philosophy. Mix and match approaches that align with your unique goals.',
        values: ['Personal autonomy', 'Flexible approach', 'Self-directed'],
        example: 'Choose your own allocation strategy',
        regions: ['Global'],
    },
];

interface StrategySelectorProps {
    onSelect: (strategy: FinancialStrategy) => void;
    currentStrategy?: FinancialStrategy;
    onSkip?: () => void;
}

export default function StrategySelector({ onSelect, currentStrategy, onSkip }: StrategySelectorProps) {
    const [selected, setSelected] = useState<FinancialStrategy | null>(currentStrategy || null);
    const [expanded, setExpanded] = useState<FinancialStrategy | null>(null);

    const handleSelect = (strategyId: FinancialStrategy) => {
        setSelected(strategyId);
        setExpanded(strategyId);
    };

    const handleConfirm = () => {
        if (selected) {
            // Haptic feedback on mobile
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(50);
            }
            onSelect(selected);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                    What&apos;s Your Wealth Philosophy?
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                    Different cultures have different approaches to wealth. Choose the philosophy that aligns with your values and goals.
                    There&apos;s no &quot;right&quot; answer - just what&apos;s authentic to you.
                </p>
            </div>

            {/* Strategy Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {STRATEGIES.map((strategy) => (
                    <motion.button
                        key={strategy.id}
                        onClick={() => handleSelect(strategy.id)}
                        className={`text-left p-5 rounded-xl border-2 transition-all ${selected === strategy.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                            }`}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: STRATEGIES.indexOf(strategy) * 0.05 }}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <motion.span
                                    className="text-3xl"
                                    animate={selected === strategy.id ? {
                                        scale: [1, 1.2, 1],
                                        rotate: [0, 10, -10, 0]
                                    } : {}}
                                    transition={{ duration: 0.5 }}
                                >
                                    {strategy.icon}
                                </motion.span>
                                <div>
                                    <h3 className="text-base font-black text-gray-900 dark:text-white">
                                        {strategy.name}
                                    </h3>
                                    {strategy.nativeName && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {strategy.nativeName}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {selected === strategy.id && (
                                <motion.span
                                    className="text-blue-500 text-xl"
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                                >
                                    ✓
                                </motion.span>
                            )}
                        </div>

                        {/* Tagline */}
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            {strategy.tagline}
                        </p>

                        {/* Description */}
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                            {strategy.description}
                        </p>

                        {/* Values */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {strategy.values.map((value, i) => (
                                <span
                                    key={i}
                                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                                >
                                    {value}
                                </span>
                            ))}
                        </div>

                        {/* Expanded Details */}
                        {expanded === strategy.id && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="pt-3 border-t border-gray-200 dark:border-gray-700"
                            >
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                    <strong>Example:</strong> {strategy.example}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    <strong>Common in:</strong> {strategy.regions.join(', ')}
                                </p>
                            </motion.div>
                        )}
                    </motion.button>
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-center">
                {onSkip && (
                    <button
                        onClick={onSkip}
                        className="px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        Skip for now
                    </button>
                )}
                <motion.button
                    onClick={handleConfirm}
                    disabled={!selected}
                    className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${selected
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        }`}
                    whileHover={selected ? { scale: 1.05 } : {}}
                    whileTap={selected ? { scale: 0.95 } : {}}
                >
                    Continue with {selected ? STRATEGIES.find(s => s.id === selected)?.name : 'Strategy'}
                </motion.button>
            </div>

            {/* Educational Note */}
            <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                    <span className="text-xl">💡</span>
                    <div className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
                        <strong>Note:</strong> Your strategy choice helps us provide relevant recommendations and metrics.
                        You can change it anytime in settings. We respect all approaches equally - there&apos;s no &quot;best&quot; strategy.
                    </div>
                </div>
            </div>
        </div>
    );
}

// Export strategy metadata for use in other components
export { STRATEGIES };
export type { Strategy };
