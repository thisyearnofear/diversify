/**
 * OpenClaw Service
 * 
 * Integrates DiversiFi with external OpenClaw instance for autonomous agent execution.
 * Provides chat interface, on-chain execution, and receipt management.
 * 
 * SECURITY: All credentials loaded from environment variables, never hardcoded.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface OpenClawMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenClawChatRequest {
  model: 'openclaw';
  messages: OpenClawMessage[];
}

export interface OpenClawChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

export interface OpenClawExecuteRequest {
  run_id: string;
  track: string;
  rpc_url: string;
  raw_tx: string;
  explorer_base: string;
}

export interface OpenClawExecuteResponse {
  success: boolean;
  run_id: string;
  track: string;
  tx_hash?: string;
  explorer_url?: string;
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
}

export interface OpenClawReceipt {
  event_id: string;
  run_id: string;
  timestamp: string;
  agent_id: string;
  action_type: string;
  tool: string;
  status: 'success' | 'error' | 'retry' | 'skipped';
  duration_ms: number;
  onchain?: {
    chain: string;
    chain_id: number;
    tx_hash: string;
    explorer_url: string;
    tx_status: string;
  };
}

export interface OpenClawRunSummary {
  schema_version: string;
  run_id: string;
  agent_id: string;
  started_at: string;
  ended_at: string;
  objective: {
    goal: string;
    success_criteria: string[];
  };
  result: {
    status: 'success' | 'partial' | 'failed';
    summary: string;
  };
  metrics: {
    actions_total: number;
    actions_success: number;
    actions_error: number;
    duration_ms: number;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

interface OpenClawConfig {
  gatewayUrl: string;
  gatewayToken: string;
  wrapperUrl: string;
  wrapperUser: string;
  wrapperPass: string;
  enabled: boolean;
}

function getConfig(): OpenClawConfig {
  return {
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || '',
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || '',
    wrapperUrl: process.env.OPENCLAW_WRAPPER_URL || '',
    wrapperUser: process.env.OPENCLAW_WRAPPER_USER || 'user',
    wrapperPass: process.env.OPENCLAW_WRAPPER_PASS || '',
    enabled: process.env.OPENCLAW_ENABLED === 'true',
  };
}

// ============================================================================
// SERVICE
// ============================================================================

export class OpenClawService {
  private config: OpenClawConfig;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private readonly CIRCUIT_BREAKER_RESET_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.config = getConfig();
  }

  // ---------------------------------------------------------------------------
  // Circuit Breaker
  // ---------------------------------------------------------------------------

  private isCircuitOpen(): boolean {
    if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.CIRCUIT_BREAKER_RESET_MS) {
        return true;
      }
      // Reset circuit breaker after timeout
      this.failureCount = 0;
    }
    return false;
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  private recordSuccess(): void {
    this.failureCount = 0;
  }

  // ---------------------------------------------------------------------------
  // HTTP Helpers
  // ---------------------------------------------------------------------------

  private getGatewayHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.gatewayToken}`,
      'Content-Type': 'application/json',
    };
  }

  private getWrapperAuth(): string {
    return `Basic ${Buffer.from(`${this.config.wrapperUser}:${this.config.wrapperPass}`).toString('base64')}`;
  }

  private getWrapperHeaders(): Record<string, string> {
    return {
      'Authorization': this.getWrapperAuth(),
      'Content-Type': 'application/json',
    };
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (response.ok) {
          this.recordSuccess();
          return response;
        }

        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`OpenClaw API error: ${response.status} ${response.statusText}`);
        }

        // Retry on 5xx errors
        lastError = new Error(`OpenClaw API error: ${response.status} ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on abort/timeout after last attempt
        if (attempt === maxRetries - 1) break;
        
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.recordFailure();
    throw lastError || new Error('OpenClaw API request failed');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Check if OpenClaw integration is enabled and configured
   */
  isEnabled(): boolean {
    return this.config.enabled && 
           !!this.config.gatewayUrl && 
           !!this.config.gatewayToken;
  }

  /**
   * Check if circuit breaker is open (service unavailable)
   */
  isUnavailable(): boolean {
    return this.isCircuitOpen();
  }

  /**
   * Send chat messages to OpenClaw gateway
   */
  async chat(messages: OpenClawMessage[]): Promise<OpenClawChatResponse> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    const request: OpenClawChatRequest = {
      model: 'openclaw',
      messages,
    };

    const response = await this.fetchWithRetry(
      `${this.config.gatewayUrl}/v1/chat/completions`,
      {
        method: 'POST',
        headers: this.getGatewayHeaders(),
        body: JSON.stringify(request),
      }
    );

    return response.json();
  }

  /**
   * Execute a command via OpenClaw wrapper console API
   */
  async executeCommand(command: string): Promise<{ output: string; exitCode: number }> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    const response = await this.fetchWithRetry(
      `${this.config.wrapperUrl}/setup/api/console/run`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getWrapperAuth(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cmd: command }),
      }
    );

    return response.json();
  }

  /**
   * Execute on-chain transaction via OpenClaw synthesis API
   */
  async executeOnchain(request: OpenClawExecuteRequest): Promise<OpenClawExecuteResponse> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    const response = await this.fetchWithRetry(
      `${this.config.wrapperUrl}/setup/api/synthesis/onchain/execute`,
      {
        method: 'POST',
        headers: this.getWrapperHeaders(),
        body: JSON.stringify(request),
      }
    );

    return response.json();
  }

  /**
   * Get receipts for a specific run
   */
  async getReceipts(runId: string): Promise<OpenClawReceipt[]> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    // Get action log from the agent state
    const response = await this.fetchWithRetry(
      `${this.config.wrapperUrl}/setup/api/console/run`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getWrapperAuth(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cmd: `cat /data/agent_state/logs/agent-actions.jsonl | grep "${runId}" || echo "[]"`
        }),
      }
    );

    const result = await response.json();
    
    // Parse JSONL format
    if (result.output) {
      const lines = result.output.trim().split('\n').filter((line: string) => line.trim());
      return lines.map((line: string) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
    }

    return [];
  }

  /**
   * Get run summary
   */
  async getRunSummary(runId: string): Promise<OpenClawRunSummary | null> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    const response = await this.fetchWithRetry(
      `${this.config.wrapperUrl}/setup/api/console/run`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getWrapperAuth(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cmd: `cat /data/agent_state/logs/run-summary.json 2>/dev/null || echo "{}"`
        }),
      }
    );

    const result = await response.json();
    
    if (result.output) {
      try {
        return JSON.parse(result.output);
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Get agent identity
   */
  async getIdentity(): Promise<Record<string, any> | null> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    const response = await this.fetchWithRetry(
      `${this.config.wrapperUrl}/setup/api/receipts/identity`,
      {
        method: 'GET',
        headers: {
          'Authorization': this.getWrapperAuth(),
        },
      }
    );

    return response.json();
  }

  /**
   * Trigger autonomous heartbeat run
   */
  async triggerHeartbeat(): Promise<{ output: string; exitCode: number }> {
    return this.executeCommand(
      'HEARTBEAT_PULSE=1 bash /data/agent_state/scripts/autonomous-ops.sh heartbeat'
    );
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const openClawService = new OpenClawService();
