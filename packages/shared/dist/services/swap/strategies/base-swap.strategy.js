"use strict";
/**
 * Base Swap Strategy Interface
 * All swap implementations must conform to this interface
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseSwapStrategy = void 0;
const ethers_1 = require("ethers");
/**
 * Abstract base class for swap strategies
 */
class BaseSwapStrategy {
    /**
     * Helper: Parse amount to BigNumber with correct decimals
     */
    parseAmount(amount, decimals) {
        try {
            return ethers_1.ethers.utils.parseUnits(amount, decimals);
        }
        catch (error) {
            throw new Error(`Invalid amount: ${amount}`);
        }
    }
    /**
     * Helper: Format BigNumber to human-readable string
     */
    formatAmount(amount, decimals) {
        return ethers_1.ethers.utils.formatUnits(amount, decimals);
    }
    /**
     * Helper: Calculate minimum output with slippage
     */
    calculateMinOutput(expectedOutput, slippageTolerance) {
        const slippageBps = Math.floor((100 - slippageTolerance) * 100);
        return expectedOutput.mul(slippageBps).div(10000);
    }
    /**
     * Helper: Log strategy execution
     */
    log(message, data) {
        console.log(`[${this.getName()}] ${message}`, data || '');
    }
    /**
     * Helper: Log error
     */
    logError(message, error) {
        console.error(`[${this.getName()}] ${message}`, error);
    }
}
exports.BaseSwapStrategy = BaseSwapStrategy;
//# sourceMappingURL=base-swap.strategy.js.map