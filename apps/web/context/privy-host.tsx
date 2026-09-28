/**
 * PrivyHost — the heavy half of the wallet stack (Privy + Wagmi + React
 * Query + viem chains). Loaded as its own chunk by the deferred
 * `PrivyProvider` so walletless visitors don't pay for it on first load.
 *
 * It renders as a LEAF sibling of the app, never around it: mounting it
 * later must not remount the app tree. `PrivyReporter` publishes Privy's
 * state up to the facade context that the app actually reads.
 */
'use client'

import { memo, useEffect, useMemo } from 'react'
import { PrivyProvider as BasePrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { celo, celoSepolia, arbitrum, arbitrumSepolia } from 'viem/chains'
import { createConfig, http } from 'wagmi'
import { createAppQueryClient } from '../lib/query-client'
import type { PrivySnapshot } from './PrivyProvider'

// Custom Arc Testnet chain — USDC is the native gas asset on Arc (18-decimal
// native accounting; the ERC-20 interface at 0x3600… is 6 decimals). Arc mainnet
// (5042) is deliberately NOT a wagmi chain here — it's a settlement rail, not a
// user-facing chain (docs/rails.md § Arc Rail).
const arcTestnet = {
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'USDC',
        symbol: 'USDC',
    },
    rpcUrls: {
        default: {
            http: [process.env.NEXT_PUBLIC_ARC_RPC || 'https://rpc.testnet.arc.network'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Arcscan Testnet',
            url: 'https://testnet.arcscan.app',
        },
    },
} as const

function PrivyReporter({ onChange }: { onChange: (s: PrivySnapshot) => void }) {
    const privy = usePrivy()
    const { wallets } = useWallets()
    useEffect(() => {
        onChange({ privy, wallets })
    }, [privy, wallets, onChange])
    return null
}

interface PrivyHostProps {
    appId: string
    onChange: (s: PrivySnapshot) => void
}

function PrivyHost({ appId, onChange }: PrivyHostProps) {
    const queryClient = useMemo<QueryClient>(() => createAppQueryClient(), [])
    const wagmiConfig = useMemo(() => createConfig({
        chains: [celo, celoSepolia, arbitrum, arbitrumSepolia, arcTestnet],
        transports: {
            [celo.id]: http(),
            [celoSepolia.id]: http(),
            [arbitrum.id]: http(),
            [arbitrumSepolia.id]: http(),
            [arcTestnet.id]: http(),
        },
    }), [])

    return (
        <BasePrivyProvider
            appId={appId}
            config={{
                loginMethods: ['email', 'google', 'twitter', 'discord', 'apple', 'sms', 'farcaster'],
                appearance: {
                    theme: 'light',
                    accentColor: '#3B82F6',
                    logo: 'https://diversifiapp.vercel.app/icon.png',
                },
                // Smart wallets: Safe accounts on Celo + configured L2s
                // Each user gets a Safe smart contract account controlled by their Privy embedded signer.
                // The agent uses Privy session signers to transact within policy-enforced limits.
                // Dashboard must also have smart wallets enabled + chains configured with bundler URLs.
                embeddedWallets: {
                    ethereum: {
                        createOnLogin: 'users-without-wallets',
                    },
                },
            }}
        >
            <QueryClientProvider client={queryClient}>
                <WagmiProvider config={wagmiConfig}>
                    <PrivyReporter onChange={onChange} />
                </WagmiProvider>
            </QueryClientProvider>
        </BasePrivyProvider>
    )
}

// Memoised: the facade re-renders on every Privy report; the host must not.
export default memo(PrivyHost)
