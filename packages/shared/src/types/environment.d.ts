interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    isMiniPay?: boolean;
    request: (request: { method: string; params?: any[] }) => Promise<any>;
    on: (eventName: string, callback: (...args: any[]) => void) => void;
    removeListener: (eventName: string, callback: (...args: any[]) => void) => void;
    selectedAddress?: string;
    chainId?: string;
  };
}
