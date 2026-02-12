'use client'

import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { arbitrum, celo, celoAlfajores } from '@reown/appkit/networks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type Config } from 'wagmi'
import { ReactNode } from 'react'
import { WALLET_FEATURES } from '../config/features'

// Set up queryClient
const queryClient = new QueryClient()

// Get projectId
const projectId = WALLET_FEATURES.APPKIT_PROJECT_ID

if (!projectId) {
    console.warn('[AppKit] Missing NEXT_PUBLIC_REOWN_PROJECT_ID')
}

// Custom network for Arc Testnet
const arcTestnet = {
    id: 5042002,
    caipNetworkId: 'eip155:5042002',
    chainNamespace: 'eip155' as const,
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
}

const networks = [celo, celoAlfajores, arbitrum, arcTestnet] as const

// Create wagmiAdapter
let wagmiAdapter: WagmiAdapter | null = null
let modal: any = null

if (projectId && typeof window !== 'undefined') {
    wagmiAdapter = new WagmiAdapter({
        projectId,
        networks: [...networks],
    })

        // Expose wagmiAdapter globally for other parts of the app
        ; (window as any).__APPKIT_WAGMI_ADAPTER__ = wagmiAdapter

    // Set up metadata
    const metadata = {
        name: 'DiversiFi',
        description: 'Stablecoin portfolio diversification',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://diversifiapp.vercel.app',
        icons: ['https://diversifiapp.vercel.app/icon.png'],
    }

    // Create the modal - this should only run once
    modal = createAppKit({
        adapters: [wagmiAdapter],
        projectId,
        networks: [networks[0], ...networks.slice(1)],
        defaultNetwork: celo,
        metadata,
        features: {
            analytics: WALLET_FEATURES.APPKIT_ANALYTICS,
            email: WALLET_FEATURES.APPKIT_EMAIL,
            socials: WALLET_FEATURES.APPKIT_SOCIALS ? ['google', 'x', 'discord', 'apple'] : false,
        },
    })

        // Expose modal globally for other parts of the app
        ; (window as any).__APPKIT_INSTANCE__ = modal

    console.log('[AppKit] Initialized successfully with social login support')
}

export function AppKitProvider({ children }: { children: ReactNode }) {
    // Only render if we have a valid wagmiAdapter
    if (!wagmiAdapter) {
        return <>{children}</>
    }

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}
