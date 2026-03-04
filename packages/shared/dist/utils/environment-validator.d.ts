/**
 * Environment Validation Utility
 * Validates required environment variables and provides helpful error messages
 */
export interface ValidationResult {
    isValid: boolean;
    missingKeys: string[];
    warnings: string[];
    suggestions: string[];
}
export declare class EnvironmentValidator {
    private static requiredKeys;
    private static optionalKeys;
    /**
     * Validates environment variables and returns detailed results
     */
    static validate(): ValidationResult;
    /**
     * Gets suggestion for a specific missing key
     */
    private static getSuggestion;
    /**
     * Logs validation results to console
     */
    static logResults(): void;
    /**
     * Throws an error if validation fails (useful for startup checks)
     */
    static requireValid(): void;
}
//# sourceMappingURL=environment-validator.d.ts.map