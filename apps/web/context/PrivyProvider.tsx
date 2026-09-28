'use client'

/**
 * PrivyProvider — deferred wallet stack + the facade the app reads.
 *
 * Privy, Wagmi, React Query and the viem chain table are the heaviest
 * part of first load, and most visitors arrive walletless. So the real
 * providers live in `privy-host.tsx`, a separate chunk mounted as a LEAF
 * sibling of the app (mounting it later never remounts the app tree):
 *
 * - Returning Privy sessions (a stored Privy token or a cached `privy`
 *   wallet preference) mount the host immediately, so auth restores as fast
 *   as before.
 * - Everyone else mounts it once the browser is idle, and immediately if
 *   they ask to connect first (`ensurePrivyReady`).
 *
 * App code imports `usePrivy` / `useWallets` from HERE, never from
 * `@privy-io/react-auth` — until the host reports, they return a not-ready
 * snapshot (`ready: false`, no user, no wallets), the same shape Privy's own
 * out-of-provider default has.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import dynamic from 'next/dynamic'
import type {
    usePrivy as UsePrivyFn,
    useWallets as UseWalletsFn,
} from '@privy-io/react-auth'
import { WALLET_FEATURES } from '../config/features'

export type PrivyApi = ReturnType<typeof UsePrivyFn>
export type PrivyWallets = ReturnType<typeof UseWalletsFn>['wallets']
export interface PrivySnapshot {
    privy: PrivyApi
    wallets: PrivyWallets
}

interface PrivyFacade extends PrivySnapshot {
    /** Mount the wallet host now (if needed) and resolve once Privy is ready. */
    ensureReady: () => Promise<PrivySnapshot>
}

/** How long a connect tap waits for the host before giving up. */
const READY_TIMEOUT_MS = 15_000
/** Walletless visitors: mount the host after idle, at most this late. */
const IDLE_MOUNT_TIMEOUT_MS = 4_000

const loadHost = () => import('./privy-host')
const PrivyHost = dynamic(loadHost, { ssr: false })

const EMPTY_WALLETS: PrivyWallets = []

function notReadyError(): Error {
    return new Error('Social login is not available right now')
}

function makeNotReadyApi(ensureReady: () => Promise<PrivySnapshot>): PrivyApi {
    // Only the members the app reads are provided. Actions made before the
    // host is ready wait for it instead of failing silently.
    return {
        ready: false,
        authenticated: false,
        user: null,
        login: async (...args: unknown[]) => {
            const { privy } = await ensureReady()
            return (privy.login as (...a: unknown[]) => unknown)(...args)
        },
        logout: async () => {},
        createWallet: async () => {
            const { privy } = await ensureReady()
            return privy.createWallet()
        },
        getAccessToken: async () => null,
    } as unknown as PrivyApi
}

/** A stored Privy session means we should restore auth without waiting. */
export function hasPrivySessionHint(): boolean {
    if (typeof window === 'undefined') return false
    try {
        const ls = window.localStorage
        if (ls.getItem('privy:token') || ls.getItem('privy:refresh_token')) return true
        const pref = ls.getItem('diversifi-wallet-preference')
        if (pref && JSON.parse(pref)?.type === 'privy') return true
    } catch {
        // Storage unavailable — treat as walletless.
    }
    return false
}

function onIdle(cb: () => void, timeout: number): () => void {
    const w = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
        const id = w.requestIdleCallback(cb, { timeout })
        return () => w.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(cb, Math.min(timeout, 1500))
    return () => window.clearTimeout(id)
}

const PrivyFacadeContext = createContext<PrivyFacade | null>(null)

export function PrivyProvider({ children }: { children: ReactNode }) {
    const appId = WALLET_FEATURES.PRIVY_APP_ID
    const [mountHost, setMountHost] = useState(false)
    const [snapshot, setSnapshot] = useState<PrivySnapshot | null>(null)
    const snapshotRef = useRef<PrivySnapshot | null>(null)
    const waitersRef = useRef<Array<(s: PrivySnapshot) => void>>([])

    const onHostChange = useCallback((next: PrivySnapshot) => {
        snapshotRef.current = next
        setSnapshot(next)
        if (next.privy.ready && waitersRef.current.length > 0) {
            const waiters = waitersRef.current
            waitersRef.current = []
            waiters.forEach((resolve) => resolve(next))
        }
    }, [])

    const ensureReady = useCallback((): Promise<PrivySnapshot> => {
        if (!appId) return Promise.reject(notReadyError())
        const current = snapshotRef.current
        if (current?.privy.ready) return Promise.resolve(current)
        setMountHost(true)
        return new Promise<PrivySnapshot>((resolve, reject) => {
            const timer = window.setTimeout(() => {
                waitersRef.current = waitersRef.current.filter((w) => w !== done)
                reject(notReadyError())
            }, READY_TIMEOUT_MS)
            const done = (s: PrivySnapshot) => {
                window.clearTimeout(timer)
                resolve(s)
            }
            waitersRef.current.push(done)
        })
    }, [appId])

    // Mount policy: returning sessions now, walletless visitors after idle.
    useEffect(() => {
        if (!appId) {
            console.warn('[Privy] Missing NEXT_PUBLIC_PRIVY_APP_ID - social login disabled')
            return
        }
        if (hasPrivySessionHint()) {
            setMountHost(true)
            return
        }
        return onIdle(() => setMountHost(true), IDLE_MOUNT_TIMEOUT_MS)
    }, [appId])

    const notReadyApi = useMemo(() => makeNotReadyApi(ensureReady), [ensureReady])

    const value = useMemo<PrivyFacade>(
        () => ({
            privy: snapshot?.privy ?? notReadyApi,
            wallets: snapshot?.wallets ?? EMPTY_WALLETS,
            ensureReady,
        }),
        [snapshot, notReadyApi, ensureReady],
    )

    return (
        <PrivyFacadeContext.Provider value={value}>
            {children}
            {appId && mountHost && <PrivyHost appId={appId} onChange={onHostChange} />}
        </PrivyFacadeContext.Provider>
    )
}

// Outside the provider (tests, isolated pages): a permanently not-ready
// facade, matching Privy's own out-of-provider behaviour.
const DETACHED_ENSURE = () => Promise.reject(notReadyError())
const DETACHED: PrivyFacade = {
    privy: makeNotReadyApi(DETACHED_ENSURE),
    wallets: EMPTY_WALLETS,
    ensureReady: DETACHED_ENSURE,
}

function useFacade(): PrivyFacade {
    return useContext(PrivyFacadeContext) ?? DETACHED
}

/** Drop-in for `@privy-io/react-auth`'s `usePrivy` (not-ready until the host mounts). */
export function usePrivy(): PrivyApi {
    return useFacade().privy
}

/** Drop-in for `@privy-io/react-auth`'s `useWallets`. */
export function useWallets(): { wallets: PrivyWallets; ready: boolean } {
    const { privy, wallets } = useFacade()
    return { wallets, ready: privy.ready }
}

/** Mount the wallet host if needed and resolve with a ready Privy snapshot. */
export function useEnsurePrivyReady(): () => Promise<PrivySnapshot> {
    return useFacade().ensureReady
}

/** Warm the wallet chunk without mounting it (e.g. on pointer-down of Connect). */
export function preloadPrivyHost(): void {
    void loadHost()
}
