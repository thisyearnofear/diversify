/**
 * Test stub for @privy-io/react-auth.
 *
 * The real SDK pulls WalletConnect → ox → @noble/curves@1.9, which
 * imports `anumber` from `@noble/hashes/utils` (hashes 1.8 API). Nested
 * 1.4/1.7 copies in this tree keep `anumber` on `_assert` (or omit it),
 * so collect crashes with `utils_1.anumber is not a function`. Unit
 * tests never need the live SDK.
 */
export function usePrivy() {
  return {
    ready: true,
    authenticated: false,
    user: null,
    login: async () => undefined,
    logout: async () => undefined,
    createWallet: async () => undefined,
  };
}

export function useWallets() {
  return { wallets: [] as unknown[] };
}

export function PrivyProvider({ children }: { children: unknown }) {
  return children;
}
