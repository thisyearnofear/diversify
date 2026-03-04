import sdk from '@farcaster/miniapp-sdk';

export async function getFarcasterProvider(): Promise<any | null> {
  try {
    if (!sdk?.wallet?.getEthereumProvider) {
      return null;
    }

    const provider = await sdk.wallet.getEthereumProvider();
    return provider?.request ? provider : null;
  } catch {
    return null;
  }
}
