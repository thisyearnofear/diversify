import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  CELO_TOKENS,
  ALFAJORES_TOKENS,
  MENTO_BROKER_ADDRESS,
  ALFAJORES_BROKER_ADDRESS,
  MENTO_ABIS,
  DEFAULT_EXCHANGE_RATES,
} from '../utils/mento-utils';
import { EXCHANGE_RATES } from '../constants/regions';

interface UseExpectedAmountOutParams {
  fromToken: string;
  toToken: string;
  amount: string;
}

export function useExpectedAmountOut({
  fromToken,
  toToken,
  amount,
}: UseExpectedAmountOutParams) {
  const [expectedOutput, setExpectedOutput] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  // Detect chain ID on mount
  useEffect(() => {
    const detectChain = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          const detectedChainId = Number.parseInt(chainIdHex as string, 16);
          setChainId(detectedChainId);
          console.log('Detected chain ID:', detectedChainId);
        } catch (err) {
          console.warn('Error detecting chain ID:', err);
        }
      }
    };

    detectChain();
  }, []);

  useEffect(() => {
    const getExpectedOutput = async () => {
      if (
        !fromToken ||
        !toToken ||
        !amount ||
        Number.parseFloat(amount) <= 0 ||
        fromToken === toToken
      ) {
        setExpectedOutput(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const output = await getExpectedAmountOut(fromToken, toToken, amount);
        setExpectedOutput(output);
      } catch (err) {
        console.warn("Error getting expected output:", err);
        setError(err instanceof Error ? err.message : 'Failed to get expected output');
        setExpectedOutput(null);
      } finally {
        setIsLoading(false);
      }
    };

    getExpectedOutput();
  }, [fromToken, toToken, amount, chainId]);

  // Get expected amount out for a swap
  const getExpectedAmountOut = async (
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<string> => {
    try {
      // Determine if we're on Alfajores testnet
      const isAlfajores = chainId === 44787;

      // Select the appropriate token list and broker address
      const tokenList = isAlfajores ? ALFAJORES_TOKENS : CELO_TOKENS;
      const brokerAddress = isAlfajores ? ALFAJORES_BROKER_ADDRESS : MENTO_BROKER_ADDRESS;

      // Get provider URL based on network
      const providerUrl = isAlfajores
        ? 'https://alfajores-forno.celo-testnet.org'
        : 'https://forno.celo.org';

      console.log(`Using ${isAlfajores ? 'Alfajores' : 'Mainnet'} network for expected amount calculation`);

      // Get token addresses
      const fromTokenAddress = tokenList[fromToken as keyof typeof tokenList];
      const toTokenAddress = tokenList[toToken as keyof typeof tokenList];

      if (!fromTokenAddress || !toTokenAddress) {
        console.warn(`Invalid token selection: ${fromToken}/${toToken}`);

        // Use fallback calculation based on exchange rates
        // This is useful when the Mento SDK can't find an exchange
        let fromRate = EXCHANGE_RATES[fromToken] || 1;
        let toRate = EXCHANGE_RATES[toToken] || 1;

        // For Alfajores testnet, use hardcoded rates for common tokens
        if (isAlfajores) {
          // Default rates for Alfajores testnet
          if (fromToken === 'CUSD') fromRate = 1;
          else if (fromToken === 'CEUR') fromRate = 1.08;
          else if (fromToken === 'CREAL') fromRate = 0.2;
          else if (fromToken === 'CXOF') fromRate = 0.0016;
          else if (fromToken === 'CKES') fromRate = 0.0078;
          else if (fromToken === 'CCOP') fromRate = 0.00025;
          else if (fromToken === 'CGHS') fromRate = 0.083;
          else if (fromToken === 'CGBP') fromRate = 1.27;
          else if (fromToken === 'CZAR') fromRate = 0.055;
          else if (fromToken === 'CCAD') fromRate = 0.74;
          else if (fromToken === 'CAUD') fromRate = 0.66;
          else if (fromToken === 'PUSO') fromRate = 0.0179;

          if (toToken === 'CUSD') toRate = 1;
          else if (toToken === 'CEUR') toRate = 1.08;
          else if (toToken === 'CREAL') toRate = 0.2;
          else if (toToken === 'CXOF') toRate = 0.0016;
          else if (toToken === 'CKES') toRate = 0.0078;
          else if (toToken === 'CCOP') toRate = 0.00025;
          else if (toToken === 'CGHS') toRate = 0.083;
          else if (toToken === 'CGBP') toRate = 1.27;
          else if (toToken === 'CZAR') toRate = 0.055;
          else if (toToken === 'CCAD') toRate = 0.74;
          else if (toToken === 'CAUD') toRate = 0.66;
          else if (toToken === 'PUSO') toRate = 0.0179;
        }

        // Calculate expected output based on exchange rates
        // If fromToken is CUSD (rate=1) and toToken is CKES (rate=0.0078),
        // and amount is 10 CUSD, then output would be 10 / 0.0078 = 1282.05 CKES
        const amountNum = Number.parseFloat(amount);
        const expectedOutput = (amountNum * fromRate) / toRate;

        console.log(`Using fallback calculation: ${amount} ${fromToken} (${fromRate}) -> ${expectedOutput.toFixed(6)} ${toToken} (${toRate})`);

        return expectedOutput.toString();
      }

      // Create a read-only provider for Celo
      const provider = new ethers.providers.JsonRpcProvider(providerUrl);

      // Convert amount to wei
      const amountInWei = ethers.utils.parseUnits(amount, 18);

      // Find the exchange for the token pair
      const brokerContract = new ethers.Contract(
        brokerAddress,
        MENTO_ABIS.BROKER_PROVIDERS,
        provider
      );

      const exchangeProviders = await brokerContract.getExchangeProviders();
      console.log(`Found ${exchangeProviders.length} exchange providers`);

      // Find the exchange for the token pair
      let exchangeProvider = "";
      let exchangeId = "";

      // Loop through providers to find the right exchange
      for (const providerAddress of exchangeProviders) {
        const exchangeContract = new ethers.Contract(
          providerAddress,
          MENTO_ABIS.EXCHANGE,
          provider
        );

        const exchanges = await exchangeContract.getExchanges();
        console.log(`Provider ${providerAddress.slice(0, 8)}... has ${exchanges.length} exchanges`);

        // Check each exchange
        for (const exchange of exchanges) {
          const assets = exchange.assets.map((a: string) => a.toLowerCase());

          if (
            assets.includes(fromTokenAddress.toLowerCase()) &&
            assets.includes(toTokenAddress.toLowerCase())
          ) {
            exchangeProvider = providerAddress;
            exchangeId = exchange.exchangeId;
            console.log(`Found exchange for ${fromToken}/${toToken}: ${exchangeId}`);
            break;
          }
        }

        if (exchangeProvider && exchangeId) break;
      }

      if (!exchangeProvider || !exchangeId) {
        console.warn(`No exchange found for ${fromToken}/${toToken}, checking for two-step swap`);

        // Check if we can do a two-step swap via CELO for specific pairs
        const canUseViaSwap = (
          // CUSD/CEUR pairs
          (fromToken === 'CUSD' && toToken === 'CEUR') ||
          (fromToken === 'CEUR' && toToken === 'CUSD') ||
          // CUSD/CREAL pairs
          (fromToken === 'CUSD' && toToken === 'CREAL') ||
          (fromToken === 'CREAL' && toToken === 'CUSD')
        );

        // Try two-step calculation on both mainnet and Alfajores
        if (canUseViaSwap) {
          try {
            console.log(`Attempting two-step calculation via CELO for ${fromToken}/${toToken}`);

            // Step 1: Find exchange for fromToken to CELO
            let fromTokenToCeloExchangeProvider = '';
            let fromTokenToCeloExchangeId = '';
            const celoAddress = tokenList.CELO;

            // Loop through providers to find exchange for fromToken to CELO
            for (const providerAddress of exchangeProviders) {
              const exchangeContract = new ethers.Contract(
                providerAddress,
                MENTO_ABIS.EXCHANGE,
                provider
              );

              const exchanges = await exchangeContract.getExchanges();

              // Check each exchange
              for (const exchange of exchanges) {
                const assets = exchange.assets.map((a: string) => a.toLowerCase());

                if (
                  assets.includes(fromTokenAddress.toLowerCase()) &&
                  assets.includes(celoAddress.toLowerCase())
                ) {
                  fromTokenToCeloExchangeProvider = providerAddress;
                  fromTokenToCeloExchangeId = exchange.exchangeId;
                  console.log(`Found exchange for ${fromToken}/CELO: ${fromTokenToCeloExchangeId}`);
                  break;
                }
              }

              if (fromTokenToCeloExchangeProvider && fromTokenToCeloExchangeId) break;
            }

            if (!fromTokenToCeloExchangeProvider || !fromTokenToCeloExchangeId) {
              throw new Error(`No exchange found for ${fromToken}/CELO`);
            }

            // Step 2: Find exchange for CELO to toToken
            let celoToToTokenExchangeProvider = '';
            let celoToToTokenExchangeId = '';

            // Loop through providers to find exchange for CELO to toToken
            for (const providerAddress of exchangeProviders) {
              const exchangeContract = new ethers.Contract(
                providerAddress,
                MENTO_ABIS.EXCHANGE,
                provider
              );

              const exchanges = await exchangeContract.getExchanges();

              // Check each exchange
              for (const exchange of exchanges) {
                const assets = exchange.assets.map((a: string) => a.toLowerCase());

                if (
                  assets.includes(celoAddress.toLowerCase()) &&
                  assets.includes(toTokenAddress.toLowerCase())
                ) {
                  celoToToTokenExchangeProvider = providerAddress;
                  celoToToTokenExchangeId = exchange.exchangeId;
                  console.log(`Found exchange for CELO/${toToken}: ${celoToToTokenExchangeId}`);
                  break;
                }
              }

              if (celoToToTokenExchangeProvider && celoToToTokenExchangeId) break;
            }

            if (!celoToToTokenExchangeProvider || !celoToToTokenExchangeId) {
              throw new Error(`No exchange found for CELO/${toToken}`);
            }

            // Step 3: Get expected amount out for fromToken to CELO
            const brokerRateContract = new ethers.Contract(
              brokerAddress,
              MENTO_ABIS.BROKER_RATE,
              provider
            );

            console.log(`Getting expected CELO amount for ${amount} ${fromToken}...`);
            const expectedCeloAmount = await brokerRateContract.getAmountOut(
              fromTokenToCeloExchangeProvider,
              fromTokenToCeloExchangeId,
              fromTokenAddress,
              celoAddress,
              amountInWei
            );

            console.log(`Expected CELO amount: ${ethers.utils.formatUnits(expectedCeloAmount, 18)} CELO`);

            // Step 4: Get expected amount out for CELO to toToken
            const expectedFinalAmount = await brokerRateContract.getAmountOut(
              celoToToTokenExchangeProvider,
              celoToToTokenExchangeId,
              celoAddress,
              toTokenAddress,
              expectedCeloAmount
            );

            const formattedAmount = ethers.utils.formatUnits(expectedFinalAmount, 18);
            console.log(`Expected final amount via two-step swap: ${formattedAmount} ${toToken}`);

            return formattedAmount;
          } catch (error) {
            console.error('Error calculating two-step expected amount:', error);
            console.log('Falling back to direct rate calculation');
          }
        }

        // Use fallback calculation based on exchange rates
        let fromRate = EXCHANGE_RATES[fromToken] || 1;
        let toRate = EXCHANGE_RATES[toToken] || 1;

        // For Alfajores testnet, use hardcoded rates for common tokens
        if (isAlfajores) {
          // Default rates for Alfajores testnet
          if (fromToken === 'CUSD') fromRate = 1;
          else if (fromToken === 'CEUR') fromRate = 1.08;
          else if (fromToken === 'CREAL') fromRate = 0.2;
          else if (fromToken === 'CXOF') fromRate = 0.0016;
          else if (fromToken === 'CKES') fromRate = 0.0078;
          else if (fromToken === 'CCOP') fromRate = 0.00025;
          else if (fromToken === 'CGHS') fromRate = 0.083;
          else if (fromToken === 'CGBP') fromRate = 1.27;
          else if (fromToken === 'CZAR') fromRate = 0.055;
          else if (fromToken === 'CCAD') fromRate = 0.74;
          else if (fromToken === 'CAUD') fromRate = 0.66;
          else if (fromToken === 'PUSO') fromRate = 0.0179;

          if (toToken === 'CUSD') toRate = 1;
          else if (toToken === 'CEUR') toRate = 1.08;
          else if (toToken === 'CREAL') toRate = 0.2;
          else if (toToken === 'CXOF') toRate = 0.0016;
          else if (toToken === 'CKES') toRate = 0.0078;
          else if (toToken === 'CCOP') toRate = 0.00025;
          else if (toToken === 'CGHS') toRate = 0.083;
          else if (toToken === 'CGBP') toRate = 1.27;
          else if (toToken === 'CZAR') toRate = 0.055;
          else if (toToken === 'CCAD') toRate = 0.74;
          else if (toToken === 'CAUD') toRate = 0.66;
          else if (toToken === 'PUSO') toRate = 0.0179;
        }

        const amountNum = Number.parseFloat(amount);
        const expectedOutput = (amountNum * fromRate) / toRate;

        console.log(`Fallback calculation: ${amount} ${fromToken} (${fromRate}) -> ${expectedOutput.toFixed(6)} ${toToken} (${toRate})`);

        return expectedOutput.toString();
      }

      // Get the expected amount out
      const brokerRateContract = new ethers.Contract(
        brokerAddress,
        MENTO_ABIS.BROKER_RATE,
        provider
      );

      try {
        const expectedAmountOut = await brokerRateContract.getAmountOut(
          exchangeProvider,
          exchangeId,
          fromTokenAddress,
          toTokenAddress,
          amountInWei
        );

        // Format the amount
        const formattedAmount = ethers.utils.formatUnits(expectedAmountOut, 18);
        console.log(`Expected output from Mento: ${formattedAmount} ${toToken}`);
        return formattedAmount;
      } catch (rateError) {
        console.error("Error getting rate from Mento:", rateError);

        // If Mento rate call fails, use fallback calculation
        let fromRate = EXCHANGE_RATES[fromToken] || 1;
        let toRate = EXCHANGE_RATES[toToken] || 1;

        // For Alfajores testnet, use hardcoded rates for common tokens
        if (isAlfajores) {
          // Default rates for Alfajores testnet
          if (fromToken === 'CUSD') fromRate = 1;
          else if (fromToken === 'CEUR') fromRate = 1.08;
          else if (fromToken === 'CREAL') fromRate = 0.2;
          else if (fromToken === 'CXOF') fromRate = 0.0016;
          else if (fromToken === 'CKES') fromRate = 0.0078;
          else if (fromToken === 'CCOP') fromRate = 0.00025;
          else if (fromToken === 'CGHS') fromRate = 0.083;
          else if (fromToken === 'CGBP') fromRate = 1.27;
          else if (fromToken === 'CZAR') fromRate = 0.055;
          else if (fromToken === 'CCAD') fromRate = 0.74;
          else if (fromToken === 'CAUD') fromRate = 0.66;
          else if (fromToken === 'PUSO') fromRate = 0.0179;

          if (toToken === 'CUSD') toRate = 1;
          else if (toToken === 'CEUR') toRate = 1.08;
          else if (toToken === 'CREAL') toRate = 0.2;
          else if (toToken === 'CXOF') toRate = 0.0016;
          else if (toToken === 'CKES') toRate = 0.0078;
          else if (toToken === 'CCOP') toRate = 0.00025;
          else if (toToken === 'CGHS') toRate = 0.083;
          else if (toToken === 'CGBP') toRate = 1.27;
          else if (toToken === 'CZAR') toRate = 0.055;
          else if (toToken === 'CCAD') toRate = 0.74;
          else if (toToken === 'CAUD') toRate = 0.66;
          else if (toToken === 'PUSO') toRate = 0.0179;
        }

        const amountNum = Number.parseFloat(amount);
        const expectedOutput = (amountNum * fromRate) / toRate;

        console.log(`Fallback after Mento error: ${amount} ${fromToken} (${fromRate}) -> ${expectedOutput.toFixed(6)} ${toToken} (${toRate})`);

        return expectedOutput.toString();
      }
    } catch (err) {
      console.error("Error getting expected amount out:", err);

      // Even if everything fails, try to return a reasonable estimate
      try {
        const amountNum = Number.parseFloat(amount);

        // Use default exchange rates as last resort
        let fromRate = 1;
        let toRate = 1;

        // Default rates for all tokens
        if (fromToken === 'CUSD') fromRate = 1;
        else if (fromToken === 'CEUR') fromRate = 1.08;
        else if (fromToken === 'CREAL') fromRate = 0.2;
        else if (fromToken === 'CXOF') fromRate = 0.0016;
        else if (fromToken === 'CKES') fromRate = 0.0078;
        else if (fromToken === 'CCOP') fromRate = 0.00025;
        else if (fromToken === 'CGHS') fromRate = 0.083;
        else if (fromToken === 'CGBP') fromRate = 1.27;
        else if (fromToken === 'CZAR') fromRate = 0.055;
        else if (fromToken === 'CCAD') fromRate = 0.74;
        else if (fromToken === 'CAUD') fromRate = 0.66;
        else if (fromToken === 'PUSO') fromRate = 0.0179;

        if (toToken === 'CUSD') toRate = 1;
        else if (toToken === 'CEUR') toRate = 1.08;
        else if (toToken === 'CREAL') toRate = 0.2;
        else if (toToken === 'CXOF') toRate = 0.0016;
        else if (toToken === 'CKES') toRate = 0.0078;
        else if (toToken === 'CCOP') toRate = 0.00025;
        else if (toToken === 'CGHS') toRate = 0.083;
        else if (toToken === 'CGBP') toRate = 1.27;
        else if (toToken === 'CZAR') toRate = 0.055;
        else if (toToken === 'CCAD') toRate = 0.74;
        else if (toToken === 'CAUD') toRate = 0.66;
        else if (toToken === 'PUSO') toRate = 0.0179;

        const expectedOutput = (amountNum * fromRate) / toRate;
        console.log(`Last resort fallback: ${amount} ${fromToken} -> ${expectedOutput.toFixed(6)} ${toToken}`);

        return expectedOutput.toString();
      } catch (fallbackErr) {
        console.error("Even fallback calculation failed:", fallbackErr);
        return "0";
      }
    }
  };

  return {
    expectedOutput,
    isLoading,
    error,
  };
}
