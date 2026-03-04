export function getInjectedProvider(): any | null {
  if (typeof window === 'undefined') return null;
  const provider = (window as any).ethereum;
  return provider?.request ? provider : null;
}
