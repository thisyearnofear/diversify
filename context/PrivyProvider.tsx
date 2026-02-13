'use client'

import { PrivyProvider as BasePrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { celo, celoAlfajores, arbitrum } from 'viem/chains'
import { createConfig, http } from 'wagmi'
import { WALLET_FEATURES } from '../config/features'

const queryClient = new QueryClient()

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

const wagmiConfig = createConfig({
    chains: [celo, celoAlfajores, arbitrum, arcTestnet],
    transports: {
        [celo.id]: http(),
        [celoAlfajores.id]: http(),
        [arbitrum.id]: http(),
        [arcTestnet.id]: http(),
    },
})

export function PrivyProvider({ children }: { children: ReactNode }) {
    const appId = WALLET_FEATURES.PRIVY_APP_ID

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
