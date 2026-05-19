/**
 * Agent Wallet Provider Interface
 * Abstracted wallet operations that agent services depend on.
 * Extracted from agent-service.ts to resolve circular dependency with wallet-service.ts.
 */
export interface AgentWalletProvider {
  getAddress(): string;
  signTransaction(tx: any): Promise<string>;
  sendTransaction(tx: any): Promise<any>;
  balanceOf(tokenAddress: string): Promise<number>;
  transfer(to: string, amount: string, tokenAddress: string): Promise<any>;
  signTypedData(domain: any, types: any, value: any): Promise<string>;
  getExecutionSigner(): any;
  initialize?(): Promise<void>;
}
