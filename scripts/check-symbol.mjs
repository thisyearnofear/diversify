import { ethers } from 'ethers';

const ERC20_SYMBOL_ABI = ['function symbol() view returns (string)'];
const USDm_ADDRESS = '0x765de816845861e75a25fca122bb6898b8b1282a';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider('https://forno.celo.org');
  const contract = new ethers.Contract(USDm_ADDRESS, ERC20_SYMBOL_ABI, provider);
  const symbol = await contract.symbol();
  console.log('Address:', USDm_ADDRESS);
  console.log('Symbol:', symbol);
}

main().catch(console.error);
