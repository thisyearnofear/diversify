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

export class EnvironmentValidator {
  private static requiredKeys = [
    'SYNTH_API_KEY',
    'GEMINI_API_KEY',
    'VENICE_API_KEY'
  ];

  private static optionalKeys = [
    'ALPHA_VANTAGE_API_KEY',
    'FRED_API_KEY',
    'COINGECKO_API_KEY',
    'ONEINCH_API_KEY'
  ];

  /**
   * Validates environment variables and returns detailed results
   */
  static validate(): ValidationResult {
    const missingKeys: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check required keys
    for (const key of this.requiredKeys) {
      const value = process.env[key];
      if (!value || value.trim() === '') {
        missingKeys.push(key);
      }
    }

    // Check optional keys
    for (const key of this.optionalKeys) {
      const value = process.env[key];
      if (!value || value.trim() === '') {
        warnings.push(`Optional API key ${key} is not configured`);
        suggestions.push(this.getSuggestion(key));
      }
    }

    // Check for common misconfigurations
    if (process.env.SYNTH_API_KEY === 'your-synth-api-key-here') {
      warnings.push('SYNTH_API_KEY appears to be a placeholder value');
      suggestions.push('Get a real Synth API key from docs.synthdata.co');
    }

    return {
      isValid: missingKeys.length === 0,
      missingKeys,
      warnings,
      suggestions
    };
  }

  /**
   * Gets suggestion for a specific missing key
   */
  private static getSuggestion(key: string): string {
    const suggestions: Record<string, string> = {
      'SYNTH_API_KEY': 'Get your Synth API key from docs.synthdata.co',
      'GEMINI_API_KEY': 'Get your Gemini API key from Google AI Studio',
      'VENICE_API_KEY': 'Get your Venice API key from the Venice platform',
      'ALPHA_VANTAGE_API_KEY': 'Get your Alpha Vantage API key from alphavantage.co',
      'FRED_API_KEY': 'Get your FRED API key from fred.stlouisfed.org',
      'COINGECKO_API_KEY': 'Get your CoinGecko API key from coingecko.com',
      'ONEINCH_API_KEY': 'Get your 1inch API key from portal.1inch.dev'
    };

    return suggestions[key] || `Configure ${key} in your environment variables`;
  }

  /**
   * Logs validation results to console
   */
  static logResults(): void {
    const result = this.validate();

    if (result.isValid) {
      console.log('✅ Environment validation passed');
    } else {
      console.warn('❌ Environment validation failed');
      console.warn('Missing required keys:', result.missingKeys.join(', '));
    }

    if (result.warnings.length > 0) {
      console.warn('⚠️ Warnings:');
      result.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    if (result.suggestions.length > 0) {
      console.info('💡 Suggestions:');
      result.suggestions.forEach(suggestion => console.info(`  - ${suggestion}`));
    }
  }

  /**
   * Throws an error if validation fails (useful for startup checks)
   */
  static requireValid(): void {
    const result = this.validate();
    
    if (!result.isValid) {
      throw new Error(
        `Environment validation failed. Missing required keys: ${result.missingKeys.join(', ')}`
      );
    }
  }
}

// Auto-log results when module is imported (development only)
if (process.env.NODE_ENV !== 'production') {
  EnvironmentValidator.logResults();
}