import { describe, expect, it } from 'vitest';
import { buildGmDepositMulticall, decodeGmDepositMulticall } from '../gmx-deposit-builder';

const ROUTER = '0x69C527fC77291722b52649E45c838e41be8Bf5d5';
const VAULT = '0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55';
const MARKET = '0x47c031236e19d024b42f8AE6780E44A573170703'; // BTC/USD GM
const WBTC = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';
const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const RECEIVER = '0xdd6204dd1b7e0311e184dbe458dcc268715ea061';

function baseInput(over = {}) {
  return {
    exchangeRouter: ROUTER,
    depositVault: VAULT,
    market: MARKET,
    initialLongToken: WBTC,
    initialShortToken: USDC,
    longAmount: '0',
    shortAmount: '100000000', // 100 USDC (6dp)
    executionFee: '1000000000000000', // 0.001 ETH
    minMarketTokens: '0',
    receiver: RECEIVER,
    ...over,
  };
}

describe('buildGmDepositMulticall', () => {
  it('attaches the execution fee as tx value and targets the router', () => {
    const tx = buildGmDepositMulticall(baseInput());
    expect(tx.to).toBe(ROUTER);
    expect(tx.value).toBe('1000000000000000');
    expect(tx.data.startsWith('0x')).toBe(true);
  });

  it('encodes sendWnt → sendTokens(USDC) → createDeposit for a stable-side deposit', () => {
    const tx = buildGmDepositMulticall(baseInput());
    const calls = decodeGmDepositMulticall(tx.data);
    expect(calls.map((c) => c.fn)).toEqual(['sendWnt', 'sendTokens', 'createDeposit']);

    const sendWnt = calls[0];
    expect(sendWnt.args.receiver).toBe(VAULT);
    expect(sendWnt.args.amount.toString()).toBe('1000000000000000');

    const sendTokens = calls[1];
    expect(sendTokens.args.token).toBe(USDC);
    expect(sendTokens.args.receiver).toBe(VAULT);
    expect(sendTokens.args.amount.toString()).toBe('100000000');

    const dep = calls[2].args.params;
    expect(dep.addresses.market).toBe(MARKET);
    expect(dep.addresses.receiver.toLowerCase()).toBe(RECEIVER.toLowerCase()); // ethers checksums on decode
    expect(dep.addresses.initialShortToken).toBe(USDC);
    expect(dep.executionFee.toString()).toBe('1000000000000000');
    expect(dep.callbackGasLimit.toString()).toBe('200000');
    expect(dep.dataList).toEqual([]); // current struct includes the reserved dataList
  });

  it('includes both token sides when both amounts are non-zero', () => {
    const tx = buildGmDepositMulticall(baseInput({ longAmount: '5000000' }));
    const calls = decodeGmDepositMulticall(tx.data);
    expect(calls.map((c) => c.fn)).toEqual(['sendWnt', 'sendTokens', 'sendTokens', 'createDeposit']);
  });

  it('rejects invalid router/vault addresses', () => {
    expect(() => buildGmDepositMulticall(baseInput({ exchangeRouter: 'nope' }))).toThrow(/valid address/);
  });

  it('rejects a zero/zero deposit', () => {
    expect(() => buildGmDepositMulticall(baseInput({ longAmount: '0', shortAmount: '0' }))).toThrow(/non-zero/);
  });
});
