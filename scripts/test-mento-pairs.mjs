import { ethers } from 'ethers';

const MENTO_BROKER_ADDRESS = '0x777a8255ca72412f0d706dc03c9d1987306b4cad';
const BROKER_PROVIDERS_ABI = ['function getExchangeProviders() view returns (address[])'];
const EXCHANGE_ABI = ['function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])'];
const ERC20_SYMBOL_ABI = ['function symbol() view returns (string)'];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider('https://forno.celo.org');
  
  console.log('Fetching tradeable pairs from Mento on Celo Mainnet...\n');
  
  const brokerContract = new ethers.Contract(MENTO_BROKER_ADDRESS, BROKER_PROVIDERS_ABI, provider);
  const exchangeProviders = await brokerContract.getExchangeProviders();
  
  console.log(`Found ${exchangeProviders.length} exchange providers\n`);
  
  const allSymbols = new Set();
  const pairs = [];
  
  for (const providerAddress of exchangeProviders) {
    const exchangeContract = new ethers.Contract(providerAddress, EXCHANGE_ABI, provider);
    const exchanges = await exchangeContract.getExchanges();
    
    for (const exchange of exchanges) {
      const pairSymbols = [];
      for (const assetAddress of exchange.assets) {
        try {
          const tokenContract = new ethers.Contract(assetAddress, ERC20_SYMBOL_ABI, provider);
          const symbol = await tokenContract.symbol();
          pairSymbols.push(symbol);
          allSymbols.add(symbol.toUpperCase());
        } catch (e) {
          pairSymbols.push('UNKNOWN');
        }
      }
      pairs.push(pairSymbols);
    }
  }
  
  console.log('=== TRADEABLE PAIRS ===');
  pairs.forEach((pair, i) => {
    console.log(`${i + 1}. ${pair.join(' <-> ')}`);
  });
  
  console.log('\n=== UNIQUE TRADEABLE SYMBOLS ===');
  console.log(Array.from(allSymbols).sort().join(', '));
  
  console.log('\n=== COMPARISON WITH CONFIG ===');
  const configTokens = ['CUSD', 'CEUR', 'CREAL', 'CKES', 'CCOP', 'PUSO', 'CGHS', 'CXOF', 'CGBP', 'CZAR', 'CCAD', 'CAUD', 'CCHF', 'CJPY', 'CNGN'];
  const missing = configTokens.filter(t => !allSymbols.has(t));
  const extra = Array.from(allSymbols).filter(t => !configTokens.includes(t));
  
  if (missing.length > 0) {
    console.log('Tokens in config but NOT tradeable on Mento:', missing.join(', '));
  }
  if (extra.length > 0) {
    console.log('Tokens tradeable on Mento but NOT in config:', extra.join(', '));
  }
}

main().catch(console.error);

// Check if old CUSD address matches new USDm
console.log('\n=== ADDRESS CHECK ===');
const OLD_CUSD = '0x765de816845861e75a25fca122bb6898b8b1282a';
const checkProvider = new ethers.providers.JsonRpcProvider('https://forno.celo.org');
const cusdContract = new ethers.Contract(OLD_CUSD, ERC20_SYMBOL_ABI, checkProvider);
const symbol = await cusdContract.symbol();
console.log(`Address ${OLD_CUSD} has symbol: ${symbol}`);
