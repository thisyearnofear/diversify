const SESSION_TTL_MS = 15 * 60 * 1000;
const STORAGE_PREFIX = 'diversifi-wallet-auth:';

export interface WalletAuthProof {
  message: string;
  signature: string;
}

interface WalletAuthPayload {
  address: string;
  issuedAt: string;
  expiresAt: string;
  purpose: 'purchase-cycles';
}

export function buildWalletAuthMessage(address: string, now = Date.now()): string {
  const payload: WalletAuthPayload = {
    address: address.toLowerCase(),
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    purpose: 'purchase-cycles',
  };
  return `DiversiFi wallet session\n${JSON.stringify(payload)}`;
}

export function parseWalletAuthMessage(message: string): WalletAuthPayload | null {
  const prefix = 'DiversiFi wallet session\n';
  if (!message.startsWith(prefix)) return null;
  try {
    const payload = JSON.parse(message.slice(prefix.length)) as WalletAuthPayload;
    if (
      payload.purpose !== 'purchase-cycles' ||
      !/^0x[a-fA-F0-9]{40}$/.test(payload.address) ||
      !Number.isFinite(Date.parse(payload.issuedAt)) ||
      !Number.isFinite(Date.parse(payload.expiresAt))
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getCachedWalletAuth(address: string): WalletAuthProof | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${address.toLowerCase()}`);
    if (!stored) return null;
    const proof = JSON.parse(stored) as WalletAuthProof;
    const payload = parseWalletAuthMessage(proof.message);
    if (!payload || payload.address !== address.toLowerCase() || Date.parse(payload.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(`${STORAGE_PREFIX}${address.toLowerCase()}`);
      return null;
    }
    return proof;
  } catch {
    return null;
  }
}

export async function getWalletAuthHeaders(
  address: string,
  signMessage?: (message: string) => Promise<string>,
): Promise<Record<string, string> | null> {
  let proof = getCachedWalletAuth(address);
  if (!proof && signMessage) {
    const message = buildWalletAuthMessage(address);
    proof = { message, signature: await signMessage(message) };
    sessionStorage.setItem(`${STORAGE_PREFIX}${address.toLowerCase()}`, JSON.stringify(proof));
  }
  if (!proof) return null;
  return {
    'X-Wallet-Auth-Message': encodeURIComponent(proof.message),
    'X-Wallet-Auth-Signature': proof.signature,
  };
}
