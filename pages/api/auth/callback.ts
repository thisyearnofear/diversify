import type { NextApiRequest, NextApiResponse } from 'next';
import { TokenVaultClient } from '../../../packages/shared/src/services/auth0-token-vault';
import { readJsonFile, writeJsonFile } from '../agent/_json-store';
import * as path from 'path';

const STORAGE_PATH = process.env.AGENT_AUTOMATION_PATH || path.join(process.cwd(), '.data', 'agent-automation-preferences.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state: privyUserId } = req.query;

  if (!code || !privyUserId || typeof code !== 'string' || typeof privyUserId !== 'string') {
    return res.status(400).json({ error: 'Missing code or state' });
  }

  const vaultClient = new TokenVaultClient({
    domain: process.env.AUTH0_DOMAIN || '',
    clientId: process.env.AUTH0_CLIENT_ID || '',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  });

  try {
    // 1. Exchange code for Auth0 tokens (including refresh token)
    const tokenResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const tokens = await tokenResponse.json();
    const { refresh_token, access_token } = tokens;

    // 2. Get Auth0 User ID
    const userResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const auth0User = await userResponse.json();
    const auth0UserId = auth0User.sub;

    // 3. Encrypt refresh token
    const encryptedRefreshToken = vaultClient.encryptToken(refresh_token || '');

    // 4. Update user preferences mapping
    const store = await readJsonFile<Record<string, any>>(STORAGE_PATH, {});
    const userPrefs = store[privyUserId] || {
        email: { enabled: false, address: '', frequency: 'immediate', types: [] },
        zapier: { enabled: false, triggers: [] },
        slack: { enabled: false, urgencyThreshold: 'HIGH' },
        google: { enabled: false, gmailEnabled: false, sheetsEnabled: false },
        thresholds: { minSavings: 25, urgencyLevel: 'MEDIUM' }
    };

    store[privyUserId] = {
      ...userPrefs,
      auth0UserId,
      auth0RefreshToken: encryptedRefreshToken,
      // Enable specific connection based on where they came from (optional enhancement)
      // For now we just store the vault access
    };

    await writeJsonFile(STORAGE_PATH, store);

    // 5. Redirect back to settings
    res.redirect('/settings?connected=true');
  } catch (error: any) {
    console.error('[Auth Callback] Error:', error);
    res.redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }
}
