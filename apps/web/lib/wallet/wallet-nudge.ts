/**
 * When the connected wallet is known-empty, point at the header wallet
 * menu — do not restage buy/copy on a tab.
 */

export function walletNeedsFunds({
  lastUpdated,
  totalValue,
  isDemo,
}: {
  lastUpdated: number | null | undefined;
  totalValue: number;
  isDemo?: boolean;
}): boolean {
  if (isDemo) return false;
  if (lastUpdated == null) return false;
  return totalValue <= 0;
}
