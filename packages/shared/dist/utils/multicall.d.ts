import { ethers } from 'ethers';
export interface ContractCall {
    address: string;
    abi: any[] | readonly any[];
    method: string;
    params?: any[];
}
export declare function executeMulticall(provider: ethers.providers.Provider, calls: ContractCall[], chainId: number): Promise<any[]>;
//# sourceMappingURL=multicall.d.ts.map