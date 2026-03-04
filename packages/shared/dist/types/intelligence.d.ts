export interface IntelligenceItem {
    id: string;
    type: "news" | "impact" | "alert";
    title: string;
    description: string;
    impact?: "positive" | "negative" | "neutral";
    impactAsset?: string;
    timestamp: string;
}
//# sourceMappingURL=intelligence.d.ts.map