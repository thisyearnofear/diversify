'use client'

import { PrivyProvider as BasePrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useMemo } from 'react'
import { celo, celoSepolia, arbitrum, arbitrumSepolia } from 'viem/chains'
import { createConfig, http } from 'wagmi'
import { WALLET_FEATURES } from '../config/features'

// Custom Arc Testnet chain
const arcTestnet = {
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'ARC',
        symbol: 'ARC',
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

export function PrivyProvider({ children }: { children: ReactNode }) {
    const appId = WALLET_FEATURES.PRIVY_APP_ID
    const queryClient = useMemo(() => new QueryClient(), [])
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

    if (!appId) {
        console.warn('[Privy] Missing NEXT_PUBLIC_PRIVY_APP_ID - social login disabled')
        return <>{children}</>
    }

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
                    {children}
                </WagmiProvider>
            </QueryClientProvider>
        </BasePrivyProvider>
    )
}
