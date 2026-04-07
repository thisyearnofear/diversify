import type { NextApiRequest, NextApiResponse } from 'next';
import { AutomationService, TokenVaultClient } from '@diversifi/shared';
import * as path from 'path';
import { readJsonFile } from './_json-store';

const STORAGE_PATH =
    process.env.AGENT_AUTOMATION_PATH || path.join(process.cwd(), '.data', 'agent-automation-preferences.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userAddress, connection } = req.body;

    if (!userAddress || !connection) {
        return res.status(400).json({ error: 'User address and connection are required' });
    }

    try {
        const store = await readJsonFile<Record<string, any>>(STORAGE_PATH, {});
        const prefs = store[userAddress.toLowerCase()];

        if (!prefs || !prefs.auth0RefreshToken) {
            return res.status(404).json({ error: 'No Token Vault connection found for this user' });
        }

        const tokenVault = new TokenVaultClient({
            domain: process.env.AUTH0_DOMAIN || '',
            clientId: process.env.AUTH0_CLIENT_ID || '',
            clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
            encryptionKey: process.env.TOKEN_VAULT_ENCRYPTION_KEY || ''
        });

        // Attempt to exchange the refresh token for a provider token
        // This verifies both the refresh token is valid and the connection exists
        const result = await tokenVault.exchangeProviderToken(prefs.auth0RefreshToken, connection);

        if (result && result.access_token) {
            return res.status(200).json({ 
                success: true, 
                message: `Successfully verified connection to ${connection}`,
                expires_in: result.expires_in
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                error: `Failed to retrieve access token for ${connection}` 
            });
        }
    } catch (error: any) {
        console.error('Connection check failed:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal server error during connection check' 
        });
    }
}
