import { FinancialStrategy } from '@/hooks/useFinancialStrategies';
import { StrategyImplications } from './types';

export function getStrategyImplications(strategy: FinancialStrategy): StrategyImplications {
    switch (strategy) {
        case 'africapitalism':
            return {
                gradient: 'from-red-500 to-orange-500',
                description: 'We\'ll help you build wealth within African economies, supporting pan-African prosperity and keeping capital in the motherland.',
                recommendations: [
                    'Swap USDC/USDT into African stablecoins (KESm, GHSm, ZARm, NGNm)',
                    'Diversify across multiple African regions',
                    'Prioritize African-sourced commodities',
                    'Minimize exposure to Western currencies'
                ],
                metrics: [
                    '50%+ African exposure = Excellent',
                    'Pan-African diversification (3+ countries)',
                    'Ubuntu score (community wealth building)',
                    'Motherland-first allocation'
                ],
                assets: ['KESm', 'GHSm', 'ZARm', 'NGNm', 'XOFm', 'African commodities']
            };

        case 'buen_vivir':
            return {
                gradient: 'from-amber-500 to-yellow-500',
                description: 'We\'ll help you achieve harmony between material wealth and community well-being, supporting Latin American sovereignty.',
                recommendations: [
                    'Swap into LatAm stablecoins (BRLm, COPm, MXNm)',
                    'Balance regional and global exposure',
                    'Support Patria Grande integration',
                    'Reduce dollar dependence'
                ],
                metrics: [
                    '40-60% LatAm exposure = Balanced',
                    'Regional integration (2+ countries)',
                    'Harmony score (material + community)',
                    'Dollar independence level'
                ],
                assets: ['BRLm', 'COPm', 'MXNm', 'ARSm', 'Regional commodities']
            };

        case 'confucian':
            return {
                gradient: 'from-purple-500 to-pink-500',
                description: 'We\'ll help you build multi-generational family wealth through thrift, long-term thinking, and supporting family obligations.',
                recommendations: [
                    'Focus on stable, long-term holdings',
                    'Prioritize savings over speculation',
                    'Support family pooling strategies',
                    'Emphasize education and growth'
                ],
                metrics: [
                    'Total family wealth growth',
                    'Savings rate consistency',
                    'Long-term holding period',
                    'Filial duty fulfillment'
                ],
                assets: ['Stable currencies', 'Yield-bearing assets', 'Education funds', 'Family pools']
            };

        case 'gotong_royong':
            return {
                gradient: 'from-green-500 to-emerald-500',
                description: 'We\'ll help you optimize for mutual aid, remittances, and shared prosperity across borders.',
                recommendations: [
                    'Optimize for low-cost remittances',
                    'Multi-chain for family transfers',
                    'Support community pooling',
                    'Prioritize Southeast Asian currencies'
                ],
                metrics: [
                    'Remittance efficiency',
                    'Multi-chain readiness',
                    'Community support level',
                    'Bayanihan spirit score'
                ],
                assets: ['PHPm', 'IDRm', 'THBm', 'VNDm', 'Multi-chain stables']
            };

        case 'islamic':
            return {
                gradient: 'from-indigo-500 to-violet-500',
                description: 'We\'ll help you build wealth through Sharia-compliant investments, avoiding riba and prioritizing halal assets.',
                recommendations: [
                    'Filter out interest-bearing assets',
                    'Prioritize asset-backed holdings (gold)',
                    'Apply Zakat purification calculations',
                    'Support Islamic financial integration'
                ],
                metrics: [
                    '100% Halal asset compliance',
                    'Riba-free portfolio status',
                    'Purification (Zakat) readiness',
                    'Social impact (Sadaqah) rating'
                ],
                assets: ['Gold-backed tokens', 'Halal-certified projects', 'Sukuk-like instruments', 'Commodities']
            };

        default:
            return {
                gradient: 'from-gray-500 to-slate-500',
                description: 'A balanced approach to global wealth management, prioritizing security and stability across all asset classes.',
                recommendations: [
                    'Diversify across major global currencies',
                    'Maintain a balanced risk profile',
                    'Regularly rebalance your holdings',
                    'Monitor global market trends'
                ],
                metrics: [
                    'Global diversification score',
                    'Volatility monitoring',
                    'Asset-liability matching',
                    'Long-term risk-adjusted return'
                ],
                assets: ['Major stables', 'Global equities', 'Fixed income', 'Alternative assets']
            };
    }
}
