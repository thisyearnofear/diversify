import type { NextApiRequest, NextApiResponse } from 'next';
import { getLiFiApiKey, getLiFiIntegratorId } from '../../../packages/shared/src/services/swap/lifi-config';

const EARN_API_BASE = 'https://earn.li.fi/v1';
const LIFI_API_BASE = 'https://li.quest/v1';
const ALLOWED_LIFI_PATHS = new Set(['quote']);

function getPathSegments(path: string | string[] | undefined): string[] {
    if (!path) {
        return [];
    }

    return Array.isArray(path) ? path : [path];
}

function appendQueryParams(url: URL, query: NextApiRequest['query']) {
    for (const [key, rawValue] of Object.entries(query)) {
        if (key === 'path' || rawValue === undefined) {
            continue;
        }

        if (Array.isArray(rawValue)) {
            for (const value of rawValue) {
                url.searchParams.append(key, value);
            }
            continue;
        }

        url.searchParams.append(key, rawValue);
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const pathSegments = getPathSegments(req.query.path);
    if (!pathSegments.length) {
        return res.status(400).json({ error: 'Missing LI.FI path' });
    }

    const apiKey = getLiFiApiKey();
    if (!apiKey) {
        return res.status(500).json({
            error: 'LIFI_API_KEY is not configured',
        });
    }

    const isEarnRequest = pathSegments[0] === 'earn';
    const upstreamPathSegments = isEarnRequest ? pathSegments.slice(1) : pathSegments;
    if (!upstreamPathSegments.length) {
        return res.status(400).json({ error: 'Missing LI.FI upstream path' });
    }

    if (!isEarnRequest && !ALLOWED_LIFI_PATHS.has(upstreamPathSegments[0])) {
        return res.status(404).json({ error: 'Unsupported LI.FI path' });
    }

    const baseUrl = isEarnRequest ? EARN_API_BASE : LIFI_API_BASE;
    const upstreamUrl = new URL(`${baseUrl}/${upstreamPathSegments.join('/')}`);
    appendQueryParams(upstreamUrl, req.query);

    try {
        const response = await fetch(upstreamUrl.toString(), {
            headers: {
                'x-integrator-id': getLiFiIntegratorId(),
                'x-lifi-api-key': apiKey,
            },
        });

        const contentType = response.headers.get('content-type') || '';
        const bodyText = await response.text();

        if (!contentType.includes('application/json')) {
            return res.status(response.status).send(bodyText);
        }

        const body = bodyText ? JSON.parse(bodyText) : {};
        return res.status(response.status).json(body);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.status(502).json({ error: errorMessage || 'LI.FI proxy request failed' });
    }
}
