import { NETWORKS } from "../config";

const EXPLORER_BY_CHAIN: Record<number, string> = Object.fromEntries(
    Object.values(NETWORKS).map((n) => [n.chainId, n.explorerUrl]),
);

export function explorerTxUrl(chainId: number, txHash: string): string {
    const base = EXPLORER_BY_CHAIN[chainId] ?? NETWORKS.CELO_MAINNET.explorerUrl;
    return `${base}/tx/${txHash}`;
}

export function chainDisplayName(chainId: number): string {
    return (
        Object.values(NETWORKS).find((n) => n.chainId === chainId)?.name ??
        `chain ${chainId}`
    );
}
