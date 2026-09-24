/**
 * Smart Account Provider Registry
 *
 * The only autonomous execution rail is MetaMask Advanced Permissions
 * (ERC-7715/7710): the Guardian redeems a permission the user granted from
 * their own smart account, enforced on-chain by the DelegationManager.
 * Savings never leave the user's wallet.
 */

import { registerProvider } from '../smart-account-provider';
import { MetaMaskDelegationProvider } from './metamask-delegation-provider';

registerProvider('metamask-delegation', () => new MetaMaskDelegationProvider());
