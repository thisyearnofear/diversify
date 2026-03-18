export function getInjectedProvider(): any | null {
  if (typeof window === 'undefined') return null;
  
  // Handle read-only window.ethereum (set by other wallets like MetaMask/Backpack)
  try {
    const provider = (window as any).ethereum;
    // Check if it's a valid provider with request method
    return provider?.request ? provider : null;
  } catch (error) {
    // window.ethereum exists but is read-only (getter only)
    console.warn('[Wallet] Cannot access window.ethereum, may be set by another extension:', error);
    return null;
  }
}
