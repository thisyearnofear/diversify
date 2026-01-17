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
}

export interface DataQualityMetrics {
    sourceReliability: Record<string, number>;
    dataFreshness: Record<string, number>;
    apiResponseTimes: Record<string, number[]>;
    errorRates: Record<string, number>;
}

export class X402Analytics {
    private metrics: PaymentMetrics;
    private qualityMetrics: DataQualityMetrics;
    private startTime: number;

    constructor() {
        this.startTime = Date.now();
        this.metrics = {
            totalPayments: 0,
            totalSpent: 0,
            averagePaymentTime: 0,
            successRate: 0,
            failureReasons: {},
            dataSourceUsage: {},
            dailySpending: {}
        };

        this.qualityMetrics = {
            sourceReliability: {},
            dataFreshness: {},
            apiResponseTimes: {},
            errorRates: {}
        };
    }

    /**
     * Record a successful payment
     */
    recordPayment(source: string, amount: number, duration: number) {
        this.metrics.totalPayments++;
        this.metrics.totalSpent += amount;
        this.metrics.dataSourceUsage[source] = (this.metrics.dataSourceUsage[source] || 0) + 1;

        // Update average payment time
        this.metrics.averagePaymentTime =
            (this.metrics.averagePaymentTime * (this.metrics.totalPayments - 1) + duration) /
            this.metrics.totalPayments;

        // Track daily spending
        const today = new Date().toISOString().split('T')[0];
        this.metrics.dailySpending[today] = (this.metrics.dailySpending[today] || 0) + amount;

        this.updateSuccessRate();

        console.log(`[X402 Analytics] Payment recorded: ${source} - $${amount} (${duration}ms)`);
    }

    /**
     * Record a payment failure
     */
    recordFailure(source: string, reason: string) {
        this.metrics.failureReasons[reason] = (this.metrics.failureReasons[reason] || 0) + 1;
        this.updateSuccessRate();

        console.warn(`[X402 Analytics] Payment failed: ${source} - ${reason}`);
    }

    /**
     * Record data quality metrics
     */
    recordDataQuality(source: string, responseTime: number, dataAge: number, hasError: boolean) {
        // Track response times
        if (!this.qualityMetrics.apiResponseTimes[source]) {
            this.qualityMetrics.apiResponseTimes[source] = [];
        }
        this.qualityMetrics.apiResponseTimes[source].push(responseTime);

        // Keep only last 100 measurements
        if (this.qualityMetrics.apiResponseTimes[source].length > 100) {
            this.qualityMetrics.apiResponseTimes[source].shift();
        }

        // Track data freshness (lower is better)
        this.qualityMetrics.dataFreshness[source] = dataAge;

        // Track error rates
        const currentErrors = this.qualityMetrics.errorRates[source] || 0;
        const totalRequests = this.metrics.dataSourceUsage[source] || 1;
        this.qualityMetrics.errorRates[source] = hasError ?
            (currentErrors * (totalRequests - 1) + 1) / totalRequests :
            (currentErrors * (totalRequests - 1)) / totalRequests;

        // Calculate reliability score (0-1)
        const avgResponseTime = this.getAverageResponseTime(source);
        const errorRate = this.qualityMetrics.errorRates[source] || 0;
        const freshnessScore = Math.max(0, 1 - (dataAge / (60 * 60 * 1000))); // Penalize data older than 1 hour

        this.qualityMetrics.sourceReliability[source] =
            (1 - errorRate) * 0.4 +
            Math.max(0, 1 - (avgResponseTime / 5000)) * 0.3 + // Penalize response times > 5s
            freshnessScore * 0.3;
    }

    /**
     * Get comprehensive analytics report
     */
    getAnalyticsReport(): {
        payments: PaymentMetrics;
        quality: DataQualityMetrics;
        insights: string[];
        recommendations: string[];
    } {
        const insights = this.generateInsights();
        const recommendations = this.generateRecommendations();

        return {
            payments: { ...this.metrics },
            quality: { ...this.qualityMetrics },
            insights,
            recommendations
        };
    }

    /**
     * Get real-time dashboard data
     */
    getDashboardData() {
        const topSources = Object.entries(this.metrics.dataSourceUsage)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        const recentSpending = Object.entries(this.metrics.dailySpending)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 7);

        return {
            totalSpent: this.metrics.totalSpent,
            totalPayments: this.metrics.totalPayments,
            successRate: this.metrics.successRate,
            averagePaymentTime: this.metrics.averagePaymentTime,
            topSources,
            recentSpending,
            systemHealth: this.calculateSystemHealth()
        };
    }

    /**
     * Export metrics for external monitoring
     */
    exportMetrics() {
        return {
            timestamp: Date.now(),
            uptime: Date.now() - this.startTime,
            metrics: this.metrics,
            quality: this.qualityMetrics,
            health: this.calculateSystemHealth()
        };
    }

    private updateSuccessRate() {
        const totalAttempts = this.metrics.totalPayments +
            Object.values(this.metrics.failureReasons).reduce((a, b) => a + b, 0);

        this.metrics.successRate = totalAttempts > 0 ?
            this.metrics.totalPayments / totalAttempts : 0;
    }

    private getAverageResponseTime(source: string): number {
        const times = this.qualityMetrics.apiResponseTimes[source] || [];
        return times.length > 0 ?
            times.reduce((a, b) => a + b, 0) / times.length : 0;
    }

    private calculateSystemHealth(): number {
        const successRateScore = this.metrics.successRate;
        const avgReliability = Object.values(this.qualityMetrics.sourceReliability)
            .reduce((a, b) => a + b, 0) /
            Math.max(1, Object.keys(this.qualityMetrics.sourceReliability).length);

        const paymentTimeScore = Math.max(0, 1 - (this.metrics.averagePaymentTime / 10000)); // Penalize > 10s

        return (successRateScore * 0.4 + avgReliability * 0.4 + paymentTimeScore * 0.2);
    }

    private generateInsights(): string[] {
        const insights: string[] = [];

        // Spending insights
        if (this.metrics.totalSpent > 0) {
            const avgCostPerPayment = this.metrics.totalSpent / this.metrics.totalPayments;
            insights.push(`Average cost per analysis: $${avgCostPerPayment.toFixed(3)}`);
        }

        // Performance insights
        if (this.metrics.averagePaymentTime > 5000) {
            insights.push(`Payment processing is slow (${this.metrics.averagePaymentTime.toFixed(0)}ms avg)`);
        }

        // Reliability insights
        const reliableSources = Object.entries(this.qualityMetrics.sourceReliability)
            .filter(([, score]) => score > 0.9)
            .map(([source]) => source);

        if (reliableSources.length > 0) {
            insights.push(`Most reliable sources: ${reliableSources.join(', ')}`);
        }

        // Usage patterns
        const mostUsedSource = Object.entries(this.metrics.dataSourceUsage)
            .sort(([, a], [, b]) => b - a)[0];

        if (mostUsedSource) {
            insights.push(`Most used data source: ${mostUsedSource[0]} (${mostUsedSource[1]} requests)`);
        }

        return insights;
    }

    private generateRecommendations(): string[] {
        const recommendations: string[] = [];

        // Cost optimization
        if (this.metrics.totalSpent > 10) {
            const avgDaily = this.metrics.totalSpent /
                Math.max(1, Object.keys(this.metrics.dailySpending).length);

            if (avgDaily > 5) {
                recommendations.push('Consider increasing caching duration to reduce API costs');
            }
        }

        // Performance optimization
        if (this.metrics.averagePaymentTime > 3000) {
            recommendations.push('Optimize payment processing - consider batching or faster RPC endpoints');
        }

        // Reliability improvements
        const unreliableSources = Object.entries(this.qualityMetrics.sourceReliability)
            .filter(([, score]) => score < 0.7)
            .map(([source]) => source);

        if (unreliableSources.length > 0) {
            recommendations.push(`Consider alternative providers for: ${unreliableSources.join(', ')}`);
        }

        // Success rate improvements
        if (this.metrics.successRate < 0.9) {
            const topFailure = Object.entries(this.metrics.failureReasons)
                .sort(([, a], [, b]) => b - a)[0];

            if (topFailure) {
                recommendations.push(`Address top failure cause: ${topFailure[0]} (${topFailure[1]} occurrences)`);
            }
        }

        return recommendations;
    }
}

// Global analytics instance
export const x402Analytics = new X402Analytics();

// Helper function to track payment performance
export function trackPaymentPerformance<T>(
    source: string,
    paymentPromise: Promise<T>
): Promise<T> {
    const startTime = Date.now();

    return paymentPromise
        .then(result => {
            const duration = Date.now() - startTime;
            x402Analytics.recordPayment(source, 0.05, duration); // Default amount
            return result;
        })
        .catch(error => {
            x402Analytics.recordFailure(source, error.message);
            throw error;
        });
}