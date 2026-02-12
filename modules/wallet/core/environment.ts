import sdk from '@farcaster/miniapp-sdk';
import { isMiniPayEnvironment } from '../../../utils/environment';

export interface WalletEnvironment {
  isMiniPay: boolean;
  isFarcaster: boolean;
  farcasterContext: any | null;
}

async function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
  ]);
}

export async function detectWalletEnvironment(): Promise<WalletEnvironment> {
  if (typeof window === 'undefined') {
    return { isMiniPay: false, isFarcaster: false, farcasterContext: null };
  }

  const isMiniPay = isMiniPayEnvironment();

  try {
    if (sdk?.actions?.ready) {
      sdk.actions.ready();
    }

    const farcasterContext = await withTimeout(sdk.context, 1000);
    if (farcasterContext) {
      return {
        isMiniPay,
        isFarcaster: true,
        farcasterContext,
      };
    }
  } catch {
    // Not Farcaster context.
  }

  return {
    isMiniPay,
    isFarcaster: false,
    farcasterContext: null,
  };
}
