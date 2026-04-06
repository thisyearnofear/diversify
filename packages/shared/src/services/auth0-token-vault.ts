/**
 * Auth0 Token Vault Client — Agent Credential Delegation.
 * 
 * Manages retrieval of user-delegated OAuth tokens for external services
 * like Slack, Google Sheets, Gmail, and Zapier.
 * 
 * Uses Auth0's federated connection token exchange: the agent authenticates
 * via Client Credentials, then retrieves the user's stored identity provider
 * tokens through the Management API.
 */

export interface TokenVaultConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const CONNECTION_MAP: Record<string, string> = {
  google: 'google-oauth2',
  slack: 'slack',
  zapier: 'zapier',
};

export class TokenVaultClient {
  private domain: string;
  private clientId: string;
  private clientSecret: string;
  private audience: string;
  private managementTokenCache: CachedToken | null = null;

  constructor(config: TokenVaultConfig) {
    this.domain = config.domain;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.audience = config.audience || `https://${config.domain}/api/v2/`;
  }

  /**
   * Get a Management API access token, reusing cached token if still valid.
   */
  private async getManagementToken(): Promise<string> {
    if (this.managementTokenCache && Date.now() < this.managementTokenCache.expiresAt) {
      return this.managementTokenCache.token;
    }

    const response = await fetch(`https://${this.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        audience: this.audience,
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      throw new Error(`Auth0 client credentials exchange failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.managementTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000
    };

    return data.access_token;
  }

  /**
   * Retrieves the user's stored identity provider token for a given connection.
   * 
   * Uses the Management API GET /api/v2/users/{id}/identities endpoint,
   * which returns the IDP access_token stored when the user linked
   * the federated connection.
   * 
   * @param userId Auth0 user ID (e.g., "auth0|abc123" or wallet-derived identifier)
   * @param connection Friendly connection name: 'google', 'slack', 'zapier'
   * @returns The IDP access token, or null if not connected
   */
  async getToken(userId: string, connection: string): Promise<string | null> {
    if (!this.domain || !this.clientId || !this.clientSecret) {
      console.warn('[Token Vault] Missing configuration, cannot retrieve token');
      return null;
    }

    const auth0Connection = CONNECTION_MAP[connection] || connection;

    try {
      const managementToken = await this.getManagementToken();

      // Fetch user identities from the Management API
      const response = await fetch(
        `https://${this.domain}/api/v2/users/${encodeURIComponent(userId)}`,
        {
          headers: {
            'Authorization': `Bearer ${managementToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 404) {
        console.warn(`[Token Vault] User ${userId} not found in Auth0`);
        return null;
      }

      if (!response.ok) {
        throw new Error(`Management API request failed: ${response.status} ${response.statusText}`);
      }

      const user = await response.json();

      // Find the identity matching the requested connection
      const identity = user.identities?.find(
        (id: { connection: string; access_token?: string }) =>
          id.connection === auth0Connection
      );

      if (!identity?.access_token) {
        console.warn(`[Token Vault] No ${connection} token found for user ${userId}`);
        return null;
      }

      return identity.access_token;
    } catch (error) {
      console.error(`[Token Vault] Error retrieving ${connection} token:`, error);
      
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Token Vault] Returning null in development — configure Auth0 to test');
      }
      
      return null;
    }
  }

  /**
   * Checks if a user has a specific connection linked (without fetching the token).
   */
  async hasConnection(userId: string, connection: string): Promise<boolean> {
    if (!this.domain || !this.clientId || !this.clientSecret) {
      return false;
    }

    const auth0Connection = CONNECTION_MAP[connection] || connection;

    try {
      const managementToken = await this.getManagementToken();

      const response = await fetch(
        `https://${this.domain}/api/v2/users/${encodeURIComponent(userId)}?fields=identities&include_fields=true`,
        {
          headers: { 'Authorization': `Bearer ${managementToken}` }
        }
      );

      if (!response.ok) return false;

      const user = await response.json();
      return user.identities?.some(
        (id: { connection: string }) => id.connection === auth0Connection
      ) ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Build the Auth0 authorization URL for a user to connect a new service.
   */
  getAuthorizationUrl(connection: string, redirectUri: string, state?: string): string {
    const auth0Connection = CONNECTION_MAP[connection] || connection;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      connection: auth0Connection,
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      ...(state && { state })
    });

    return `https://${this.domain}/authorize?${params.toString()}`;
  }
}
