export type ArcResearchCategory = 'basic' | 'premium';
export type ArcResearchDataType = 'inflation' | 'exchange' | 'economic' | 'sentiment' | 'yield';

export interface ArcResearchSourceDefinition {
  id: string;
  label: string;
  aliases: string[];
  category: ArcResearchCategory;
  price: string;
  freeLimit: number;
  dataType: ArcResearchDataType;
  fetchKey: string;
  priority: number;
  reputation: number;
  freshnessWindowMinutes: number;
  description: string;
}

export interface ArcResearchEvidenceRecord {
  sourceId: string;
  label: string;
  dataType: ArcResearchDataType;
  category: ArcResearchCategory;
  cost: number;
  tier: 'free' | 'paid';
  freshnessMinutes: number;
  reputation: number;
  data: any;
}

export interface ArcResearchBundle {
  sources: ArcResearchEvidenceRecord[];
  totalCost: number;
  averageReputation: number;
  freshnessScore: number;
  agreementScore: number;
  confidence: number;
  generatedAt: string;
  requestSources: string[];
}

export interface ArcAgentDataSourceTemplate {
  name: string;
  url: string;
  cost: { amount: string; currency: 'USDC' };
  priority: number;
  dataType: ArcResearchDataType;
  x402Enabled: boolean;
  headers: Record<string, string>;
}

export const ARC_RESEARCH_SOURCE_REGISTRY: Record<string, ArcResearchSourceDefinition> = {
  alpha_vantage_enhanced: {
    id: 'alpha_vantage_enhanced',
    label: 'Alpha Vantage Enhanced',
    aliases: ['alpha_vantage', 'alpha-vantage'],
    category: 'basic',
    price: '0.001',
    freeLimit: 10,
    dataType: 'exchange',
    fetchKey: 'alpha_vantage_enhanced',
    priority: 6,
    reputation: 0.71,
    freshnessWindowMinutes: 20,
    description: 'FX and cross-currency reference data',
  },
  world_bank_analytics: {
    id: 'world_bank_analytics',
    label: 'World Bank Analytics',
    aliases: ['world_bank', 'truflation'],
    category: 'basic',
    price: '0.001',
    freeLimit: 20,
    dataType: 'inflation',
    fetchKey: 'world_bank_analytics',
    priority: 1,
    reputation: 0.92,
    freshnessWindowMinutes: 24 * 60,
    description: 'Inflation and macro development indicators',
  },
  coingecko_analytics: {
    id: 'coingecko_analytics',
    label: 'CoinGecko Analytics',
    aliases: ['coingecko', 'glassnode'],
    category: 'basic',
    price: '0.001',
    freeLimit: 50,
    dataType: 'sentiment',
    fetchKey: 'coingecko_analytics',
    priority: 3,
    reputation: 0.8,
    freshnessWindowMinutes: 10,
    description: 'Market pricing and sentiment proxy',
  },
  defillama_realtime: {
    id: 'defillama_realtime',
    label: 'DeFiLlama Realtime',
    aliases: ['defillama', 'defi-yields'],
    category: 'basic',
    price: '0.001',
    freeLimit: 50,
    dataType: 'yield',
    fetchKey: 'defillama_realtime',
    priority: 2,
    reputation: 0.9,
    freshnessWindowMinutes: 30,
    description: 'Realtime yield and TVL data',
  },
  yearn_optimizer: {
    id: 'yearn_optimizer',
    label: 'Yearn Optimizer',
    aliases: ['yearn', 'yearn-fi'],
    category: 'basic',
    price: '0.001',
    freeLimit: 20,
    dataType: 'yield',
    fetchKey: 'yearn_optimizer',
    priority: 4,
    reputation: 0.86,
    freshnessWindowMinutes: 60,
    description: 'Vault ranking and auto-compound opportunities',
  },
  fred_insights: {
    id: 'fred_insights',
    label: 'FRED Insights',
    aliases: ['fred'],
    category: 'basic',
    price: '0.001',
    freeLimit: 50,
    dataType: 'economic',
    fetchKey: 'fred_insights',
    priority: 5,
    reputation: 0.96,
    freshnessWindowMinutes: 24 * 60,
    description: 'Treasury yields and economic indicators',
  },
  macro_analysis: {
    id: 'macro_analysis',
    label: 'Macro Regime Oracle',
    aliases: ['macro-regime'],
    category: 'premium',
    price: '0.004',
    freeLimit: 0,
    dataType: 'economic',
    fetchKey: 'macro_analysis',
    priority: 0,
    reputation: 0.94,
    freshnessWindowMinutes: 15,
    description: 'Cross-source macro regime synthesis',
  },
  portfolio_optimization: {
    id: 'portfolio_optimization',
    label: 'Portfolio Optimization',
    aliases: ['rwa-markets'],
    category: 'premium',
    price: '0.005',
    freeLimit: 0,
    dataType: 'economic',
    fetchKey: 'portfolio_optimization',
    priority: 7,
    reputation: 0.88,
    freshnessWindowMinutes: 30,
    description: 'Portfolio allocation and rebalancing recommendations',
  },
  risk_assessment: {
    id: 'risk_assessment',
    label: 'Risk Assessment',
    aliases: [],
    category: 'premium',
    price: '0.006',
    freeLimit: 0,
    dataType: 'economic',
    fetchKey: 'risk_assessment',
    priority: 8,
    reputation: 0.87,
    freshnessWindowMinutes: 30,
    description: 'Stress-testing and downside analysis',
  },
  agent_execution: {
    id: 'agent_execution',
    label: 'Agent Execution',
    aliases: [],
    category: 'premium',
    price: '0.01',
    freeLimit: 0,
    dataType: 'economic',
    fetchKey: 'agent_execution',
    priority: 9,
    reputation: 0.84,
    freshnessWindowMinutes: 15,
    description: 'Autonomous execution planning and control',
  },
  real_time_inflation: {
    id: 'real_time_inflation',
    label: 'Real-Time Inflation',
    aliases: ['real-time-inflation'],
    category: 'premium',
    price: '0.004',
    freeLimit: 0,
    dataType: 'inflation',
    fetchKey: 'real_time_inflation',
    priority: 1,
    reputation: 0.93,
    freshnessWindowMinutes: 15,
    description: 'Live inflation proxy for immediate portfolio checks',
  },
} as const;

export type ArcResearchSourceId = keyof typeof ARC_RESEARCH_SOURCE_REGISTRY;

export const ARC_RESEARCH_SOURCE_ALIASES: Record<string, ArcResearchSourceId> = Object.freeze(
  Object.values(ARC_RESEARCH_SOURCE_REGISTRY).reduce((aliases, source) => {
    aliases[source.id] = source.id as ArcResearchSourceId;
    for (const alias of source.aliases) {
      aliases[alias] = source.id as ArcResearchSourceId;
    }
    return aliases;
  }, {} as Record<string, ArcResearchSourceId>)
);

export function normalizeArcResearchSource(source: string): ArcResearchSourceId {
  const trimmed = source.trim();
  const suffixed = trimmed.replace(/(_enhanced|_analytics|_realtime|_optimizer|_insights)$/, '');
  const resolved = ARC_RESEARCH_SOURCE_ALIASES[trimmed]
    || ARC_RESEARCH_SOURCE_ALIASES[suffixed]
    || trimmed;

  if (resolved in ARC_RESEARCH_SOURCE_REGISTRY) {
    return resolved as ArcResearchSourceId;
  }

  return suffixed in ARC_RESEARCH_SOURCE_REGISTRY
    ? suffixed as ArcResearchSourceId
    : trimmed as ArcResearchSourceId;
}

export function getArcResearchSource(source: string): ArcResearchSourceDefinition | null {
  const resolved = normalizeArcResearchSource(source);
  return ARC_RESEARCH_SOURCE_REGISTRY[resolved] || null;
}

export function listArcResearchSources(): ArcResearchSourceDefinition[] {
  return Object.values(ARC_RESEARCH_SOURCE_REGISTRY).sort((left, right) => left.priority - right.priority);
}

export function getArcResearchSourcesByType(dataType: ArcResearchDataType): ArcResearchSourceDefinition[] {
  return listArcResearchSources().filter((source) => source.dataType === dataType);
}

export function getDefaultArcResearchBundleSources(): ArcResearchSourceId[] {
  return ['macro_analysis', 'world_bank_analytics', 'coingecko_analytics', 'defillama_realtime', 'portfolio_optimization'];
}

export function createArcAgentDataSourceTemplates(basePath = '/api/agent/x402-gateway'): ArcAgentDataSourceTemplate[] {
  return listArcResearchSources().map((source) => ({
    name: source.label,
    url: `${basePath}?source=${source.id}`,
    cost: { amount: source.price, currency: 'USDC' },
    priority: source.priority,
    dataType: source.dataType,
    x402Enabled: true,
    headers: { Accept: 'application/json' },
  }));
}

export function buildArcResearchBundle(records: ArcResearchEvidenceRecord[]): ArcResearchBundle {
  const totalCost = records.reduce((sum, record) => sum + record.cost, 0);
  const averageReputation = records.length > 0
    ? records.reduce((sum, record) => sum + record.reputation, 0) / records.length
    : 0;
  const freshnessScore = records.length > 0
    ? records.reduce((sum, record) => {
        const source = ARC_RESEARCH_SOURCE_REGISTRY[record.sourceId as ArcResearchSourceId];
        const window = source?.freshnessWindowMinutes || 60;
        return sum + Math.max(0, 1 - Math.min(record.freshnessMinutes, window) / window);
      }, 0) / records.length
    : 0;
  const distinctDataTypes = new Set(records.map((record) => record.dataType)).size;
  const agreementScore = records.length <= 1
    ? 0.74
    : Math.min(0.97, 0.72 + (records.length * 0.04) + (distinctDataTypes * 0.02));
  const confidence = Math.max(0, Math.min(1, (averageReputation * 0.42) + (freshnessScore * 0.32) + (agreementScore * 0.26)));

  return {
    sources: records,
    totalCost,
    averageReputation,
    freshnessScore,
    agreementScore,
    confidence,
    generatedAt: new Date().toISOString(),
    requestSources: records.map((record) => record.sourceId),
  };
}

export function summarizeArcResearchBundle(bundle: ArcResearchBundle): string {
  const lines = [
    `Bundle confidence: ${(bundle.confidence * 100).toFixed(0)}%`,
    `Agreement score: ${(bundle.agreementScore * 100).toFixed(0)}%`,
    `Freshness score: ${(bundle.freshnessScore * 100).toFixed(0)}%`,
    `Average reputation: ${(bundle.averageReputation * 100).toFixed(0)}%`,
    `Total cost: $${bundle.totalCost.toFixed(3)} USDC`,
  ];

  for (const source of bundle.sources) {
    lines.push(`- ${source.label} [${source.dataType}] ${source.tier} $${source.cost.toFixed(3)} rep ${(source.reputation * 100).toFixed(0)}%`);
  }

  return lines.join('\n');
}
