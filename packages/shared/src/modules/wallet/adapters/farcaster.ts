export async function getFarcasterProvider(): Promise<any | null> {
  try {
    const { default: sdk } = await import('@farcaster/miniapp-sdk');
    if (!sdk?.wallet?.getEthereumProvider) {
      return null;
    }

    const provider = await sdk.wallet.getEthereumProvider();
    return provider?.request ? provider : null;
  } catch {
    return null;
  }
}
