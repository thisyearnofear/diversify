/**
 * X402 Analytics and Monitoring
 * Tracks payment performance, data quality, and system health
 */
export interface PaymentMetrics {
    totalPayments: number;
    totalSpent: number;
    averagePaymentTime: number;
    successRate: number;
    failureReasons: Record<string, number>;
    dataSourceUsage: Record<string, number>;
    dailySpending: Record<string, number>;
    paymentMethods?: Record<string, number>;
}
export interface DataQualityMetrics {
    sourceReliability: Record<string, number>;
    dataFreshness: Record<string, number>;
    apiResponseTimes: Record<string, number[]>;
    errorRates: Record<string, number>;
}
export declare class X402Analytics {
    private metrics;
    private qualityMetrics;
    private startTime;
    constructor();
    /**
     * Record a successful payment
     */
    recordPayment(source: string, amount: number, duration: number, paymentMethod?: string): void;
    /**
     * Record a payment failure
     */
    recordFailure(source: string, reason: string): void;
    /**
     * Record data quality metrics
     */
    recordDataQuality(source: string, responseTime: number, dataAge: number, hasError: boolean): void;
    /**
     * Get comprehensive analytics report
     */
    getAnalyticsReport(): {
        payments: PaymentMetrics;
        quality: DataQualityMetrics;
        insights: string[];
        recommendations: string[];
    };
    /**
     * Get real-time dashboard data
     */
    getDashboardData(): {
        totalSpent: number;
        totalPayments: number;
        successRate: number;
        averagePaymentTime: number;
        topSources: [string, number][];
        recentSpending: [string, number][];
        systemHealth: number;
    };
    /**
     * Export metrics for external monitoring
     */
    exportMetrics(): {
        timestamp: number;
        uptime: number;
        metrics: PaymentMetrics;
        quality: DataQualityMetrics;
        health: number;
    };
    private updateSuccessRate;
    private getAverageResponseTime;
    private calculateSystemHealth;
    private generateInsights;
    private generateRecommendations;
}
export declare const x402Analytics: X402Analytics;
export declare function trackPaymentPerformance<T>(source: string, paymentPromise: Promise<T>): Promise<T>;
//# sourceMappingURL=x402-analytics.d.ts.map