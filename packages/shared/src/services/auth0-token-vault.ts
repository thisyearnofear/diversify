/**
 * Auth0 Token Vault Client — Agent Credential Delegation.
 *
 * Uses the real Token Vault token exchange grant to retrieve external provider
 * access tokens on behalf of users.
 *
 * Flow:
 *  1. User connects an external service (Google, Slack) via Auth0 Connected Accounts
 *  2. Auth0 stores the provider's access + refresh tokens in Token Vault
 *  3. Agent exchanges a stored Auth0 refresh token for the provider's access token
 *     via POST /oauth/token with the Token Vault grant type
 *
 * Architecture:
 *  - Privy = primary app auth (wallet, social login, smart account)
 *  - Auth0 = secondary auth for off-chain service delegation only
 */

export interface TokenVaultConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience?: string;
}

export interface TokenVaultExchangeResult {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  issued_token_type: string;
}

const CONNECTION_MAP: Record<string, string> = {
  google: 'google-oauth2',
  slack: 'slack',
};

const TOKEN_VAULT_GRANT_TYPE =
  'urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token';

import * as crypto from 'crypto';

export class TokenVaultClient {
  private domain: string;
  private clientId: string;
  private clientSecret: string;
  private encryptionKey: string;

  constructor(config: TokenVaultConfig & { encryptionKey?: string }) {
    this.domain = config.domain;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.encryptionKey = config.encryptionKey || process.env.TOKEN_VAULT_ENCRYPTION_KEY || '';
  }

  /**
   * Encrypt a sensitive token (e.g., Auth0 refresh token) for storage at rest.
   * Uses AES-256-GCM for authenticated encryption.
   */
  encryptToken(token: string): string {
    if (!token) return '';
    if (!this.encryptionKey) {
      console.warn('[Token Vault] No encryption key provided, returning plain token');
      return token;
    }

    try {
      // Key must be 32 bytes for aes-256-gcm
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag().toString('hex');
      
      // Format: iv:authTag:encrypted
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      console.error('[Token Vault] Encryption failed:', error);
      throw new Error('Token encryption failed');
    }
  }

  /**
   * Decrypt a token stored at rest.
   */
  decryptToken(encryptedData: string): string {
    if (!encryptedData) return '';
    if (!this.encryptionKey || !encryptedData.includes(':')) {
      return encryptedData;
    }

    try {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('[Token Vault] Decryption failed:', error);
      throw new Error('Token decryption failed');
    }
  }

  /**
   * Exchange a user's Auth0 refresh token for an external provider's access token
   * via the Token Vault token exchange grant.
   */
  async getToken(auth0RefreshToken: string, connection: string): Promise<string | null> {
    return this.exchangeProviderToken(auth0RefreshToken, connection);
  }

  /**
   * Exchange a user's Auth0 refresh token for an external provider's access token
   * via the Token Vault token exchange grant.
   *
   * POST https://{domain}/oauth/token
   * grant_type: urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token
   *
   * @param auth0RefreshToken The user's Auth0 refresh token (stored when they connected the service)
   * @param connection Friendly name: 'google', 'slack'
   * @returns The provider's access token and metadata, or null if exchange fails
   */
  async exchangeProviderToken(auth0RefreshToken: string, connection: string): Promise<string | null> {
    if (!this.domain || !this.clientId || !this.clientSecret) {
      console.warn('[Token Vault] Missing configuration');
      return null;
    }

    if (!auth0RefreshToken) {
      console.warn(`[Token Vault] No Auth0 refresh token available for ${connection} exchange`);
      return null;
    }

    // Decrypt if it looks encrypted
    const decryptedToken = this.decryptToken(auth0RefreshToken);
    const auth0Connection = CONNECTION_MAP[connection] || connection;

    try {
      const result = await this.exchangeToken(decryptedToken, auth0Connection);
      return result.access_token;
    } catch (error) {
      console.error(`[Token Vault] ${connection} token exchange failed:`, error);
      return null;
    }
  }

  /**
   * Check if a user has a connection established.
   * In the real Token Vault, this would check if we have a stored Auth0 refresh token
   * and possibly verify it with Auth0.
   */
  hasConnection(auth0RefreshToken?: string): boolean {
    return !!auth0RefreshToken;
  }

  /**
   * Legacy/Social login token retrieval fallback.
   * 
   * Retrieves tokens stored on user.identities[] via Management API.
   * @deprecated Use exchangeProviderToken (Token Vault) for better security and UX.
   */
  async getLegacyIdentityTokenViaManagementApi(auth0UserId: string, connection: string): Promise<string | null> {
    console.warn('[Token Vault] Falling back to legacy Management API token retrieval');
    // Implementation would use client credentials to get Management API token,
    // then call GET /api/v2/users/{id} and read user.identities[].access_token
    return null; 
  }

  /**
   * Perform the Token Vault token exchange.
   *
   * Uses refresh_token as the subject token type — the backend exchanges
   * the user's Auth0 refresh token for an external provider access token.
   */
  async exchangeToken(
    auth0RefreshToken: string,
    connection: string
  ): Promise<TokenVaultExchangeResult> {
    const response = await fetch(`https://${this.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: TOKEN_VAULT_GRANT_TYPE,
        subject_token: auth0RefreshToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:refresh_token',
        requested_token_type:
          'http://auth0.com/oauth/token-type/federated-connection-access-token',
        connection,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Token Vault exchange failed (${response.status}): ${body}`
      );
    }

    return response.json();
  }

  /**
   * Build the Auth0 authorization URL for the Connected Accounts flow.
   *
   * This initiates the secondary Auth0 login — the user authenticates with
   * the external provider (e.g., Google) through Auth0, which stores the
   * provider tokens in Token Vault.
   * 
   * Note: For "Connected Accounts / My Account API", we ensure offline_access
   * and access_type=offline are requested to obtain a long-lived refresh token.
   */
  getAuthorizationUrl(
    connection: string,
    redirectUri: string,
    state?: string
  ): string {
    const auth0Connection = CONNECTION_MAP[connection] || connection;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      connection: auth0Connection,
      redirect_uri: redirectUri,
      scope: 'openid profile email offline_access',
      access_type: 'offline',
      prompt: 'consent', // Ensure we get a refresh token
      ...(state && { state }),
    });

    return `https://${this.domain}/authorize?${params.toString()}`;
  }
}
